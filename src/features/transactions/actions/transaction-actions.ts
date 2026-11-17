"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CreateTransactionSchema,
  CreateInstallmentPurchaseSchema,
  UpdateTransactionSchema,
  UuidParamSchema,
  type CreateTransactionInput,
  type CreateInstallmentPurchaseInput,
  type UpdateTransactionInput,
} from "@/lib/validations/finance";
import { addMoney, subtractMoney, splitInstallments, roundMoney } from "@/lib/finance/money";
import type { Database } from "@/types/database.types";
import type { ActionResult } from "@/types/actions";

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

export interface ListTransactionsFilter {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Obtiene la lista de transacciones del usuario autenticado con filtros opcionales.
 */
export async function listTransactions(
  filters: ListTransactionsFilter = {}
): Promise<ActionResult<TransactionRow[]>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });

    if (filters.accountId) {
      query = query.eq("account_id", filters.accountId);
    }

    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId);
    }

    if (filters.startDate) {
      query = query.gte("transaction_date", filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte("transaction_date", filters.endDate);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    return { success: true, data: transactions || [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while fetching transactions";
    return { success: false, error: message };
  }
}

/**
 * Registra una transacción estándar (Ingreso o Gasto) verificando propiedad de cuenta y categoría,
 * y actualizando el balance correspondiente con precisión decimal exacta.
 *
 * @param rawInput Datos de la transacción sin validar.
 */
export async function createTransaction(
  rawInput: unknown
): Promise<ActionResult<TransactionRow>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const parseResult = CreateTransactionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the submitted transaction data.",
        validationErrors: parseResult.error.flatten().fieldErrors,
      };
    }

    const validated: CreateTransactionInput = parseResult.data;

    // 1. Validar que la cuenta pertenezca al usuario autenticado
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, account_type, current_balance, is_active")
      .eq("id", validated.account_id)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return { success: false, error: "The selected account does not exist or access is denied" };
    }

    if (!account.is_active) {
      return { success: false, error: "Cannot register transactions on an inactive account" };
    }

    // Regla de negocio: No se pueden registrar ingresos en tarjetas de crédito
    if (account.account_type === "credit_card" && validated.transaction_type === "income") {
      return {
        success: false,
        error: "Income transactions cannot be registered against a credit card account",
      };
    }

    // 2. Validar que la categoría pertenezca al usuario autenticado y coincida en tipo
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id, category_type")
      .eq("id", validated.category_id)
      .eq("user_id", user.id)
      .single();

    if (categoryError || !category) {
      return { success: false, error: "The selected category does not exist or access is denied" };
    }

    if (category.category_type !== validated.transaction_type) {
      return {
        success: false,
        error: `Category type '${category.category_type}' does not match transaction type '${validated.transaction_type}'`,
      };
    }

    // 3. Calcular el nuevo balance utilizando aritmética decimal
    const currentBalanceStr = roundMoney(account.current_balance);
    const amountStr = roundMoney(validated.amount);
    let newBalanceStr: string;

    if (account.account_type === "credit_card") {
      // En tarjetas de crédito, un gasto incrementa la deuda pendiente
      newBalanceStr = addMoney(currentBalanceStr, amountStr);
    } else {
      // En cuentas bancarias o efectivo:
      // Ingreso incrementa el dinero disponible, gasto lo reduce
      newBalanceStr =
        validated.transaction_type === "income"
          ? addMoney(currentBalanceStr, amountStr)
          : subtractMoney(currentBalanceStr, amountStr);
    }

    const newBalanceNum = parseFloat(newBalanceStr);

    // 4. Insertar la transacción
    const insertPayload: Database["public"]["Tables"]["transactions"]["Insert"] = {
      user_id: user.id,
      account_id: validated.account_id,
      category_id: validated.category_id,
      description: validated.description,
      amount: parseFloat(amountStr),
      transaction_type: validated.transaction_type,
      transaction_date: validated.transaction_date,
      is_installment: validated.installment_count > 1,
      installment_count: validated.installment_count,
      notes: validated.notes ?? null,
    };

    const { data: insertedTransaction, error: insertError } = await supabase
      .from("transactions")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return { success: false, error: `Failed to insert transaction: ${insertError.message}` };
    }

    // 5. Actualizar el balance actual de la cuenta
    const { error: updateBalanceError } = await supabase
      .from("accounts")
      .update({ current_balance: newBalanceNum })
      .eq("id", account.id)
      .eq("user_id", user.id);

    if (updateBalanceError) {
      // Error crítico al actualizar balance
      return {
        success: false,
        error: `Transaction created, but failed to update account balance: ${updateBalanceError.message}`,
      };
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true, data: insertedTransaction };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while creating transaction";
    return { success: false, error: message };
  }
}

/**
 * Registra una compra diferida a cuotas en una tarjeta de crédito,
 * calculando la distribución exacta de las cuotas con asignación de centavos.
 *
 * @param rawInput Datos de la compra diferida.
 */
export async function createInstallmentPurchase(
  rawInput: unknown
): Promise<ActionResult<{ transaction: TransactionRow; installments: string[] }>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const parseResult = CreateInstallmentPurchaseSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Validation failed. Please verify installment purchase data.",
        validationErrors: parseResult.error.flatten().fieldErrors,
      };
    }

    const validated: CreateInstallmentPurchaseInput = parseResult.data;

    // 1. Validar que la cuenta pertenezca al usuario y sea de tipo 'credit_card'
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, account_type, current_balance, credit_limit, is_active")
      .eq("id", validated.account_id)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return { success: false, error: "Credit card account not found or access denied" };
    }

    if (account.account_type !== "credit_card") {
      return {
        success: false,
        error: "Installment purchases can only be registered on credit card accounts",
      };
    }

    if (!account.is_active) {
      return { success: false, error: "Credit card account is inactive" };
    }

    // 2. Validar que la categoría pertenezca al usuario y sea de tipo gasto
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id, category_type")
      .eq("id", validated.category_id)
      .eq("user_id", user.id)
      .single();

    if (categoryError || !category) {
      return { success: false, error: "Category not found or access denied" };
    }

    if (category.category_type !== "expense") {
      return { success: false, error: "Installment purchases must be assigned to an expense category" };
    }

    // 3. Calcular la división de cuotas con precisión decimal
    const amountStr = roundMoney(validated.amount);
    const installments = splitInstallments(amountStr, validated.installment_count);

    // 4. Actualizar balance de la tarjeta (suma total de la compra incrementa la deuda)
    const currentBalanceStr = roundMoney(account.current_balance);
    const newBalanceStr = addMoney(currentBalanceStr, amountStr);
    const newBalanceNum = parseFloat(newBalanceStr);

    // 5. Insertar la transacción (almacenada como 1 registro con is_installment y installment_count)
    const insertPayload: Database["public"]["Tables"]["transactions"]["Insert"] = {
      user_id: user.id,
      account_id: validated.account_id,
      category_id: validated.category_id,
      description: validated.description,
      amount: parseFloat(amountStr),
      transaction_type: "expense",
      transaction_date: validated.transaction_date,
      is_installment: validated.installment_count > 1,
      installment_count: validated.installment_count,
      notes: validated.notes ?? null,
    };

    const { data: insertedTransaction, error: insertError } = await supabase
      .from("transactions")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return { success: false, error: `Failed to insert installment transaction: ${insertError.message}` };
    }

    // 6. Actualizar el balance de la tarjeta de crédito
    const { error: updateBalanceError } = await supabase
      .from("accounts")
      .update({ current_balance: newBalanceNum })
      .eq("id", account.id)
      .eq("user_id", user.id);

    if (updateBalanceError) {
      return {
        success: false,
        error: `Transaction created, but failed to update card balance: ${updateBalanceError.message}`,
      };
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        transaction: insertedTransaction,
        installments,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while creating installment purchase";
    return { success: false, error: message };
  }
}

/**
 * Actualiza una transacción existente recalculando con precisión decimal
 * el balance de las cuentas afectadas (tanto cuenta origen como destino si fue reasignada).
 *
 * @param transactionId UUID de la transacción a actualizar.
 * @param rawInput Campos parciales a actualizar validados por UpdateTransactionSchema.
 */
export async function updateTransaction(
  transactionId: string,
  rawInput: unknown
): Promise<ActionResult<TransactionRow>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const uuidCheck = UuidParamSchema.safeParse(transactionId);
    if (!uuidCheck.success) {
      return { success: false, error: "ID de transacción inválido (formato UUID requerido)" };
    }

    const parseResult = UpdateTransactionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Validation failed. Please verify transaction data.",
        validationErrors: parseResult.error.flatten().fieldErrors,
      };
    }

    const validated: UpdateTransactionInput = parseResult.data;

    // 1. Obtener la transacción existente asegurando pertenencia al usuario
    const { data: existingTx, error: fetchTxError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (fetchTxError || !existingTx) {
      return { success: false, error: "Transaction not found or access denied" };
    }

    const targetType = validated.transaction_type ?? existingTx.transaction_type;
    const targetAccountId = validated.account_id ?? existingTx.account_id;

    // 2. Si se actualiza la categoría, validar pertenencia y correspondencia con el tipo
    const targetCategoryId = validated.category_id ?? existingTx.category_id;
    if (validated.category_id || validated.transaction_type) {
      const { data: category, error: catError } = await supabase
        .from("categories")
        .select("id, category_type")
        .eq("id", targetCategoryId)
        .eq("user_id", user.id)
        .single();

      if (catError || !category) {
        return { success: false, error: "Category not found or access denied" };
      }

      if (category.category_type !== targetType) {
        return {
          success: false,
          error: `Category type '${category.category_type}' does not match transaction type '${targetType}'`,
        };
      }
    }

    // 3. Si se transfiere a otra cuenta, validar la nueva cuenta
    if (targetAccountId !== existingTx.account_id) {
      const { data: targetAccount, error: accError } = await supabase
        .from("accounts")
        .select("id, account_type, is_active")
        .eq("id", targetAccountId)
        .eq("user_id", user.id)
        .single();

      if (accError || !targetAccount) {
        return { success: false, error: "Target account not found or access denied" };
      }

      if (!targetAccount.is_active) {
        return { success: false, error: "Target account is inactive" };
      }

      if (targetAccount.account_type === "credit_card" && targetType === "income") {
        return { success: false, error: "Income transactions cannot be assigned to a credit card" };
      }
    }

    // 4. Preparar payload de actualización
    const updatePayload: Database["public"]["Tables"]["transactions"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if (validated.description !== undefined) updatePayload.description = validated.description;
    if (validated.amount !== undefined) updatePayload.amount = parseFloat(roundMoney(validated.amount));
    if (validated.transaction_type !== undefined) updatePayload.transaction_type = validated.transaction_type;
    if (validated.transaction_date !== undefined) updatePayload.transaction_date = validated.transaction_date;
    if (validated.category_id !== undefined) updatePayload.category_id = validated.category_id;
    if (validated.account_id !== undefined) updatePayload.account_id = validated.account_id;
    if (validated.notes !== undefined) updatePayload.notes = validated.notes;
    if (validated.is_paid !== undefined) updatePayload.is_paid = validated.is_paid;
    if (validated.installment_count !== undefined) {
      updatePayload.installment_count = validated.installment_count;
      updatePayload.is_installment = validated.installment_count > 1;
    }

    const { data: updatedTx, error: updateError } = await supabase
      .from("transactions")
      .update(updatePayload)
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !updatedTx) {
      return { success: false, error: `Failed to update transaction: ${updateError?.message}` };
    }

    // 5. Ajustar balances de cuentas afectadas utilizando aritmética decimal
    if (existingTx.account_id === targetAccountId) {
      // Misma cuenta: revertir efecto anterior y aplicar efecto nuevo
      const { data: account } = await supabase
        .from("accounts")
        .select("id, account_type, current_balance")
        .eq("id", targetAccountId)
        .eq("user_id", user.id)
        .single();

      if (account) {
        let currentBalStr = roundMoney(account.current_balance);
        const oldAmountStr = roundMoney(existingTx.amount);
        const newAmountStr = roundMoney(updatedTx.amount);

        if (account.account_type === "credit_card") {
          // Revertir efecto viejo (si era gasto no pagado)
          if (existingTx.transaction_type === "expense" && !existingTx.is_paid) {
            currentBalStr = subtractMoney(currentBalStr, oldAmountStr);
          }
          // Aplicar efecto nuevo (si es gasto no pagado)
          if (updatedTx.transaction_type === "expense" && !updatedTx.is_paid) {
            currentBalStr = addMoney(currentBalStr, newAmountStr);
          }
          if (parseFloat(currentBalStr) < 0) currentBalStr = "0.00";
        } else {
          // Revertir efecto viejo en cuenta bancaria/efectivo
          currentBalStr =
            existingTx.transaction_type === "income"
              ? subtractMoney(currentBalStr, oldAmountStr)
              : addMoney(currentBalStr, oldAmountStr);
          // Aplicar efecto nuevo
          currentBalStr =
            updatedTx.transaction_type === "income"
              ? addMoney(currentBalStr, newAmountStr)
              : subtractMoney(currentBalStr, newAmountStr);
        }

        await supabase
          .from("accounts")
          .update({
            current_balance: parseFloat(currentBalStr),
            updated_at: new Date().toISOString(),
          })
          .eq("id", account.id)
          .eq("user_id", user.id);
      }
    } else {
      // Revertir en cuenta original
      const { data: oldAccount } = await supabase
        .from("accounts")
        .select("id, account_type, current_balance")
        .eq("id", existingTx.account_id)
        .eq("user_id", user.id)
        .single();

      if (oldAccount) {
        let oldBalStr = roundMoney(oldAccount.current_balance);
        const oldAmountStr = roundMoney(existingTx.amount);

        if (oldAccount.account_type === "credit_card") {
          if (existingTx.transaction_type === "expense" && !existingTx.is_paid) {
            oldBalStr = subtractMoney(oldBalStr, oldAmountStr);
            if (parseFloat(oldBalStr) < 0) oldBalStr = "0.00";
          }
        } else {
          oldBalStr =
            existingTx.transaction_type === "income"
              ? subtractMoney(oldBalStr, oldAmountStr)
              : addMoney(oldBalStr, oldAmountStr);
        }

        await supabase
          .from("accounts")
          .update({
            current_balance: parseFloat(oldBalStr),
            updated_at: new Date().toISOString(),
          })
          .eq("id", oldAccount.id)
          .eq("user_id", user.id);
      }

      // Aplicar en nueva cuenta
      const { data: newAccount } = await supabase
        .from("accounts")
        .select("id, account_type, current_balance")
        .eq("id", targetAccountId)
        .eq("user_id", user.id)
        .single();

      if (newAccount) {
        let newBalStr = roundMoney(newAccount.current_balance);
        const newAmountStr = roundMoney(updatedTx.amount);

        if (newAccount.account_type === "credit_card") {
          if (updatedTx.transaction_type === "expense" && !updatedTx.is_paid) {
            newBalStr = addMoney(newBalStr, newAmountStr);
          }
        } else {
          newBalStr =
            updatedTx.transaction_type === "income"
              ? addMoney(newBalStr, newAmountStr)
              : subtractMoney(newBalStr, newAmountStr);
        }

        await supabase
          .from("accounts")
          .update({
            current_balance: parseFloat(newBalStr),
            updated_at: new Date().toISOString(),
          })
          .eq("id", newAccount.id)
          .eq("user_id", user.id);
      }
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/credit-cards");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return { success: true, data: updatedTx };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while updating transaction";
    return { success: false, error: message };
  }
}

/**
 * Elimina una transacción (gasto, ingreso o compra a cuotas) y recalcula
 * con exactitud decimal el saldo de la cuenta afectada.
 *
 * @param transactionId UUID de la transacción a eliminar.
 */
export async function deleteTransaction(
  transactionId: string
): Promise<ActionResult<{ id: string; accountId: string }>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const uuidCheck = UuidParamSchema.safeParse(transactionId);
    if (!uuidCheck.success) {
      return { success: false, error: "ID de transacción inválido (formato UUID requerido)" };
    }

    // 1. Obtener los datos de la transacción antes de eliminarla
    const { data: transaction, error: fetchTxError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (fetchTxError || !transaction) {
      return { success: false, error: "Transaction not found or access denied" };
    }

    // 2. Obtener la cuenta vinculada para actualizar su balance
    const { data: account } = await supabase
      .from("accounts")
      .select("id, account_type, current_balance")
      .eq("id", transaction.account_id)
      .eq("user_id", user.id)
      .single();

    // 3. Eliminar la transacción
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", user.id);

    if (deleteError) {
      return { success: false, error: `Failed to delete transaction: ${deleteError.message}` };
    }

    // 4. Recalcular y actualizar balance de la cuenta afectada
    if (account) {
      const currentBalStr = roundMoney(account.current_balance);
      const amountStr = roundMoney(transaction.amount);
      let newBalanceStr: string;

      if (account.account_type === "credit_card") {
        // En tarjetas de crédito: eliminar un gasto no pagado reduce la deuda
        if (transaction.transaction_type === "expense" && !transaction.is_paid) {
          newBalanceStr = subtractMoney(currentBalStr, amountStr);
          if (parseFloat(newBalanceStr) < 0) newBalanceStr = "0.00";
        } else {
          newBalanceStr = currentBalStr;
        }
      } else {
        // En cuentas de efectivo/banco:
        // Eliminar un ingreso reduce el saldo disponible.
        // Eliminar un gasto restaura el dinero disponible.
        newBalanceStr =
          transaction.transaction_type === "income"
            ? subtractMoney(currentBalStr, amountStr)
            : addMoney(currentBalStr, amountStr);
      }

      await supabase
        .from("accounts")
        .update({
          current_balance: parseFloat(newBalanceStr),
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
        .eq("user_id", user.id);
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/credit-cards");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return {
      success: true,
      data: { id: transactionId, accountId: transaction.account_id },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while deleting transaction";
    return { success: false, error: message };
  }
}


