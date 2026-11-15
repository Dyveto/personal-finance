"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CreateTransactionSchema,
  CreateInstallmentPurchaseSchema,
  type CreateTransactionInput,
  type CreateInstallmentPurchaseInput,
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
