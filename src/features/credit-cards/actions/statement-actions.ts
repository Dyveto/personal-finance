"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MarkExtractAsPaidSchema,
  type MarkExtractAsPaidInput,
} from "@/lib/validations/finance";
import { addMoney, subtractMoney, roundMoney, compareMoney } from "@/lib/finance/money";
import { calculateFourPerThousand } from "@/lib/finance/four-per-thousand";
import {
  calculateStatementClosingDate,
  calculatePaymentDueDate,
  parseCivilDate,
  formatCivilDate,
  clampDayToMonth,
  diffCivilDays,
} from "@/lib/finance/calendar";
import { projectTransactionInstallments } from "@/lib/finance/projections";
import type { Database, CreditCardStatementRow } from "@/types/database.types";
import type { ActionResult } from "@/types/actions";

export interface MarkExtractAsPaidResult {
  statement: CreditCardStatementRow;
  amountPaid: number;
  updatedTransactionsCount: number;
  paymentAccountId: string | null;
}

/**
 * Registra formalmente el pago de un extracto de tarjeta de crédito para un mes específico (YYYY-MM).
 *
 * Acciones ejecutadas:
 * 1. Verifica titularidad de la tarjeta de crédito y de la cuenta de pago (si aplica).
 * 2. Identifica las cuotas y consumos asociados al período y actualiza `is_paid = true` y `paid_at = NOW()`.
 * 3. Crea o actualiza el registro en `public.credit_card_statements` marcándolo como pagado.
 * 4. Reduce la deuda acumulada (`current_balance`) en la tarjeta de crédito.
 * 5. Si se especifica una cuenta bancaria o de efectivo de pago, descuenta el valor pagado y registra
 *    el movimiento de salida de dinero.
 *
 * @param rawInputOrMonth Objeto con MarkExtractAsPaidInput o string del mes del extracto ("YYYY-MM").
 * @param creditCardAccountId UUID de la cuenta de tarjeta de crédito (si se usa firma posicional).
 * @param paymentAccountId UUID opcional de la cuenta bancaria o de efectivo para liquidar el pago.
 * @param amount Monto opcional a pagar (si se omite, se calcula a partir de las cuotas del mes).
 */
export async function markExtractAsPaid(
  rawInputOrMonth: unknown,
  creditCardAccountId?: string,
  paymentAccountId?: string,
  amount?: number
): Promise<ActionResult<MarkExtractAsPaidResult>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    // Normalizar entrada (acepta tanto objeto como parámetros posicionales)
    let rawInput: unknown;
    if (typeof rawInputOrMonth === "string" && creditCardAccountId) {
      rawInput = {
        statementMonth: rawInputOrMonth,
        creditCardAccountId,
        paymentAccountId: paymentAccountId ?? null,
        amount: amount !== undefined ? amount : undefined,
      };
    } else {
      rawInput = rawInputOrMonth;
    }

    const parseResult = MarkExtractAsPaidSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the submitted statement payment data.",
        validationErrors: parseResult.error.flatten().fieldErrors,
      };
    }

    const validated: MarkExtractAsPaidInput = parseResult.data;

    // 1. Validar titularidad de la tarjeta de crédito
    const { data: card, error: cardError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", validated.creditCardAccountId)
      .eq("user_id", user.id)
      .single();

    if (cardError || !card) {
      return { success: false, error: "Credit card account not found or access denied" };
    }

    if (card.account_type !== "credit_card") {
      return { success: false, error: "The selected account is not a credit card" };
    }

    if (!card.is_active) {
      return { success: false, error: "Credit card account is inactive" };
    }

    // 2. Validar cuenta de pago si fue provista
    let paymentAccount: Database["public"]["Tables"]["accounts"]["Row"] | null = null;
    if (validated.paymentAccountId) {
      const { data: payAcc, error: payError } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", validated.paymentAccountId)
        .eq("user_id", user.id)
        .single();

      if (payError || !payAcc) {
        return { success: false, error: "Payment account not found or access denied" };
      }

      if (payAcc.account_type === "credit_card") {
        return { success: false, error: "Payment account cannot be a credit card" };
      }

      if (!payAcc.is_active) {
        return { success: false, error: "Payment account is inactive" };
      }

      paymentAccount = payAcc;
    }

    // 3. Consultar transacciones de la tarjeta para calcular cuotas del extracto
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", card.id)
      .eq("user_id", user.id);

    if (txError) {
      return { success: false, error: `Database error while fetching transactions: ${txError.message}` };
    }

    const cardClosingDay = card.closing_day || 15;
    const cardPaymentDueDay = card.payment_due_day || 5;

    let calculatedPeriodTotal = "0.00";
    const txIdsToMarkPaid: string[] = [];

    for (const tx of transactions || []) {
      if (tx.is_paid) continue;

      if (!tx.is_installment || tx.installment_count <= 1) {
        // Compra regular de 1 cuota
        const closingDate = calculateStatementClosingDate(tx.transaction_date, cardClosingDay);
        const { year, month } = parseCivilDate(closingDate);
        const txMonth = `${year}-${String(month).padStart(2, "0")}`;

        if (txMonth === validated.statementMonth) {
          calculatedPeriodTotal = addMoney(calculatedPeriodTotal, roundMoney(tx.amount));
          txIdsToMarkPaid.push(tx.id);
        }
      } else {
        // Compra diferida en cuotas
        const projections = projectTransactionInstallments(tx, {
          name: card.name,
          closing_day: cardClosingDay,
          payment_due_day: cardPaymentDueDay,
        });

        const inst = projections.find((p) => p.statementMonth === validated.statementMonth);
        if (inst) {
          calculatedPeriodTotal = addMoney(calculatedPeriodTotal, roundMoney(inst.amount));
          // Si es la última cuota, se marca la transacción completa como liquidada
          if (inst.installmentNumber === inst.totalInstallments) {
            txIdsToMarkPaid.push(tx.id);
          }
        }
      }
    }

    const finalAmountStr =
      validated.amount !== undefined ? roundMoney(validated.amount) : calculatedPeriodTotal;
    const finalAmountNum = parseFloat(finalAmountStr);

    if (finalAmountNum <= 0) {
      return { success: false, error: "El monto a pagar debe ser mayor a 0 COP." };
    }

    // Validar que el monto no supere la deuda total de la tarjeta
    const currentCardDebtStr = roundMoney(card.current_balance);
    if (compareMoney(finalAmountStr, currentCardDebtStr) > 0) {
      return {
        success: false,
        error: `El monto a pagar ($${finalAmountStr} COP) no puede superar la deuda total de la tarjeta ($${currentCardDebtStr} COP).`,
      };
    }

    // Validar saldo suficiente en la cuenta de origen si fue provista (contemplando 4x1000 si aplica)
    let fourPerThousandStr = "0.00";
    let totalDebitedFromAccountStr = finalAmountStr;

    if (paymentAccount && finalAmountNum > 0) {
      fourPerThousandStr = calculateFourPerThousand(
        finalAmountStr,
        paymentAccount.has_four_per_thousand,
        "expense"
      );
      totalDebitedFromAccountStr = addMoney(finalAmountStr, fourPerThousandStr);

      const currentPayBalStr = roundMoney(paymentAccount.current_balance);
      if (compareMoney(currentPayBalStr, totalDebitedFromAccountStr) < 0) {
        const errorDetail =
          compareMoney(fourPerThousandStr, "0.00") > 0
            ? `Se requieren $${totalDebitedFromAccountStr} COP (abono: $${finalAmountStr} COP + 4x1000: $${fourPerThousandStr} COP)`
            : `Monto requerido: $${finalAmountStr} COP`;
        return {
          success: false,
          error: `Saldo insuficiente en ${paymentAccount.name}. ${errorDetail}. Saldo disponible: $${currentPayBalStr} COP.`,
        };
      }
    }

    // 4. Actualizar estado de transacciones del período a is_paid = true
    if (txIdsToMarkPaid.length > 0) {
      const { error: markTxError } = await supabase
        .from("transactions")
        .update({
          is_paid: true,
          paid_at: new Date().toISOString(),
        })
        .in("id", txIdsToMarkPaid)
        .eq("user_id", user.id);

      if (markTxError) {
        return { success: false, error: `Failed to mark transactions as paid: ${markTxError.message}` };
      }
    }

    // 5. Crear o actualizar el registro en credit_card_statements
    const [stmtYear, stmtMonth] = validated.statementMonth.split("-").map(Number);
    const closingDay = clampDayToMonth(stmtYear, stmtMonth, cardClosingDay);
    const closingDate = formatCivilDate(stmtYear, stmtMonth, closingDay);
    const dueDate = calculatePaymentDueDate(closingDate, cardClosingDay, cardPaymentDueDay);
    const calculatedPeriodTotalNum = parseFloat(calculatedPeriodTotal);

    const { data: statementRecord, error: stmtError } = await supabase
      .from("credit_card_statements")
      .upsert(
        {
          user_id: user.id,
          account_id: card.id,
          statement_month: validated.statementMonth,
          closing_date: closingDate,
          due_date: dueDate,
          total_amount: calculatedPeriodTotalNum > 0 ? calculatedPeriodTotalNum : finalAmountNum,
          paid_amount: finalAmountNum,
          payment_type: validated.paymentType || "full",
          minimum_payment: calculatedPeriodTotalNum > 0 ? calculatedPeriodTotalNum : finalAmountNum,
          payment_account_id: paymentAccount?.id ?? null,
          is_paid: true,
          paid_at: new Date().toISOString(),
          notes:
            validated.notes ??
            (paymentAccount
              ? `Pagado mediante cuenta ${paymentAccount.name} (${validated.paymentType || "full"})`
              : "Extracto registrado como pagado"),
        },
        { onConflict: "user_id,account_id,statement_month" }
      )
      .select()
      .single();

    if (stmtError) {
      return { success: false, error: `Failed to record credit card statement: ${stmtError.message}` };
    }

    // 6. Reducir deuda acumulada de la tarjeta de crédito (únicamente el valor del abono)
    const newCardDebt = Math.max(0, parseFloat(subtractMoney(currentCardDebtStr, finalAmountStr)));

    const { error: cardBalError } = await supabase
      .from("accounts")
      .update({ current_balance: newCardDebt })
      .eq("id", card.id)
      .eq("user_id", user.id);

    if (cardBalError) {
      return { success: false, error: `Failed to update card balance: ${cardBalError.message}` };
    }

    // 7. Si se proporcionó cuenta de pago y el monto es mayor a 0, debitar (base + 4x1000) y registrar movimiento
    if (paymentAccount && finalAmountNum > 0) {
      const currentPayBal = roundMoney(paymentAccount.current_balance);
      const newPayBal = parseFloat(subtractMoney(currentPayBal, totalDebitedFromAccountStr));

      const { error: payBalError } = await supabase
        .from("accounts")
        .update({ current_balance: newPayBal })
        .eq("id", paymentAccount.id)
        .eq("user_id", user.id);

      if (payBalError) {
        return {
          success: false,
          error: `Failed to debit payment account: ${payBalError.message}`,
        };
      }

      // Obtener o asignar categoría de gasto para el pago
      let categoryId = validated.categoryId;
      if (!categoryId) {
        const { data: catList } = await supabase
          .from("categories")
          .select("id, name")
          .eq("user_id", user.id)
          .eq("category_type", "expense")
          .limit(10);

        const matching = catList?.find((c) =>
          /financ|tarjeta|extracto|pago|other|otro/i.test(c.name)
        );
        categoryId = matching?.id ?? catList?.[0]?.id;
      }

      if (categoryId) {
        const todayDate =
          validated.paymentDate ??
          (() => {
            const now = new Date();
            return formatCivilDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
          })();

        const gmfNum = parseFloat(fourPerThousandStr);
        let insertedPaymentTxId: string | null = null;

        const insertQuery = supabase.from("transactions").insert({
          user_id: user.id,
          account_id: paymentAccount.id,
          category_id: categoryId,
          description: `Pago extracto tarjeta ${card.name} (${validated.statementMonth})`,
          amount: parseFloat(totalDebitedFromAccountStr),
          four_per_thousand_amount: gmfNum,
          is_four_per_thousand_applied: gmfNum > 0,
          transaction_type: "expense",
          transaction_date: todayDate,
          is_installment: false,
          installment_count: 1,
          is_paid: true,
          paid_at: new Date().toISOString(),
          notes:
            validated.notes ??
            (gmfNum > 0
              ? `Pago de extracto ${validated.statementMonth} (Abono tarjeta: $${finalAmountStr} COP · 4x1000: $${fourPerThousandStr} COP)`
              : `Pago de extracto ${validated.statementMonth} (${validated.paymentType === "minimum" ? "Pago Mínimo" : validated.paymentType === "full" ? "Pago Total" : "Monto Personalizado"})`),
        });

        if ("select" in insertQuery && typeof (insertQuery as unknown as Record<string, unknown>).select === "function") {
          const res = await (insertQuery as unknown as { select: (cols: string) => { single: () => Promise<{ data: { id: string } | null }> } })
            .select("id")
            .single();
          insertedPaymentTxId = res?.data?.id ?? null;
        } else {
          await insertQuery;
        }

        if (insertedPaymentTxId && statementRecord) {
          await supabase
            .from("credit_card_statements")
            .update({ payment_transaction_id: insertedPaymentTxId })
            .eq("id", statementRecord.id)
            .eq("user_id", user.id);
        }
      }
    }

    try {
      revalidatePath("/credit-cards");
      revalidatePath("/accounts");
      revalidatePath("/transactions");
      revalidatePath("/dashboard");
      revalidatePath("/");
    } catch {}

    return {
      success: true,
      data: {
        statement: statementRecord,
        amountPaid: finalAmountNum,
        updatedTransactionsCount: txIdsToMarkPaid.length,
        paymentAccountId: paymentAccount ? paymentAccount.id : null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while marking statement as paid";
    return { success: false, error: message };
  }
}

export interface RevertStatementPaymentResult {
  statement: CreditCardStatementRow;
  revertedAmount: number;
  restoredCardDebt: number;
  reimbursedAccountId: string | null;
}

/**
 * Revierte o elimina de forma segura un pago de extracto registrado por error:
 * 1. Restaura el saldo en la cuenta de origen (reembolsando el débito y borrando la transacción de egreso asociada).
 * 2. Restaura la deuda en la tarjeta de crédito (sumando de nuevo el monto revertido).
 * 3. Restaura las transacciones y cuotas del período a estado pendiente (is_paid = false).
 * 4. Actualiza el extracto a pendiente (is_paid = false, paid_at = null, paid_amount = null, payment_type = null).
 */
export async function revertStatementPayment(
  rawInput: unknown
): Promise<ActionResult<RevertStatementPaymentResult>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const statementId =
      typeof rawInput === "string"
        ? rawInput
        : rawInput && typeof rawInput === "object" && "statementId" in rawInput
        ? String((rawInput as { statementId: unknown }).statementId)
        : "";

    if (!statementId) {
      return { success: false, error: "Se requiere un ID de extracto válido para revertir el pago." };
    }

    // 1. Obtener el extracto registrado
    const { data: statement, error: stmtErr } = await supabase
      .from("credit_card_statements")
      .select("*")
      .eq("id", statementId)
      .eq("user_id", user.id)
      .single();

    if (stmtErr || !statement) {
      return { success: false, error: "Extracto no encontrado o acceso denegado" };
    }

    if (!statement.is_paid) {
      return { success: false, error: "Este extracto no figura como pagado; no se puede revertir." };
    }

    const amountToRevertStr = roundMoney(statement.paid_amount || statement.total_amount);
    const amountToRevertNum = parseFloat(amountToRevertStr);

    // 2. Obtener la tarjeta de crédito
    const { data: card, error: cardErr } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", statement.account_id)
      .eq("user_id", user.id)
      .single();

    if (cardErr || !card) {
      return { success: false, error: "Tarjeta de crédito asociada no encontrada" };
    }

    // 3. Reembolsar a la cuenta de origen si existe y eliminar la transacción vinculada (contemplando 4x1000 debitado)
    let reimbursedAccountId: string | null = null;
    let actualReimbursedAmountStr = amountToRevertStr;

    if (statement.payment_transaction_id) {
      const { data: linkedTx } = await supabase
        .from("transactions")
        .select("id, amount, four_per_thousand_amount, account_id")
        .eq("id", statement.payment_transaction_id)
        .eq("user_id", user.id)
        .single();

      if (linkedTx && linkedTx.amount) {
        actualReimbursedAmountStr = roundMoney(linkedTx.amount);
      }

      await supabase
        .from("transactions")
        .delete()
        .eq("id", statement.payment_transaction_id)
        .eq("user_id", user.id);
    }

    if (statement.payment_account_id && amountToRevertNum > 0) {
      const { data: payAcc } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", statement.payment_account_id)
        .eq("user_id", user.id)
        .single();

      if (payAcc) {
        // Fallback: si no existía payment_transaction_id pero la cuenta es gravada con 4x1000
        if (!statement.payment_transaction_id && payAcc.has_four_per_thousand) {
          const gmf = calculateFourPerThousand(amountToRevertStr, true, "expense");
          actualReimbursedAmountStr = addMoney(amountToRevertStr, gmf);
        }

        const newPayBal = parseFloat(
          addMoney(roundMoney(payAcc.current_balance), actualReimbursedAmountStr)
        );
        await supabase
          .from("accounts")
          .update({ current_balance: newPayBal })
          .eq("id", payAcc.id)
          .eq("user_id", user.id);
        reimbursedAccountId = payAcc.id;
      }
    }

    // 4. Restaurar la deuda en la tarjeta de crédito (únicamente el monto del abono sin 4x1000)
    const restoredCardDebt = parseFloat(
      addMoney(roundMoney(card.current_balance), amountToRevertStr)
    );
    await supabase
      .from("accounts")
      .update({ current_balance: restoredCardDebt })
      .eq("id", card.id)
      .eq("user_id", user.id);

    // 5. Restaurar transacciones del período a is_paid = false
    const cardClosingDay = card.closing_day || 15;
    const cardPaymentDueDay = card.payment_due_day || 5;

    const { data: cardTxList } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", card.id)
      .eq("user_id", user.id);

    const txIdsToUnmark: string[] = [];
    for (const tx of cardTxList || []) {
      if (!tx.is_installment || tx.installment_count <= 1) {
        const closingDate = calculateStatementClosingDate(tx.transaction_date, cardClosingDay);
        const { year, month } = parseCivilDate(closingDate);
        const txMonth = `${year}-${String(month).padStart(2, "0")}`;
        if (txMonth === statement.statement_month) {
          txIdsToUnmark.push(tx.id);
        }
      } else {
        const projections = projectTransactionInstallments(tx, {
          name: card.name,
          closing_day: cardClosingDay,
          payment_due_day: cardPaymentDueDay,
        });
        const inst = projections.find((p) => p.statementMonth === statement.statement_month);
        if (inst) {
          txIdsToUnmark.push(tx.id);
        }
      }
    }

    if (txIdsToUnmark.length > 0) {
      await supabase
        .from("transactions")
        .update({
          is_paid: false,
          paid_at: null,
        })
        .in("id", txIdsToUnmark)
        .eq("user_id", user.id);
    }

    // 6. Actualizar el extracto a pendiente
    const { data: updatedStatement, error: updateStmtErr } = await supabase
      .from("credit_card_statements")
      .update({
        is_paid: false,
        paid_at: null,
        paid_amount: null,
        payment_type: null,
        payment_account_id: null,
        payment_transaction_id: null,
        notes: "Pago revertido por el usuario",
      })
      .eq("id", statement.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateStmtErr) {
      return { success: false, error: `Error al revertir el extracto: ${updateStmtErr.message}` };
    }

    try {
      revalidatePath("/credit-cards");
      revalidatePath("/accounts");
      revalidatePath("/transactions");
      revalidatePath("/dashboard");
      revalidatePath("/");
    } catch {}

    return {
      success: true,
      data: {
        statement: updatedStatement,
        revertedAmount: amountToRevertNum,
        restoredCardDebt,
        reimbursedAccountId,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al revertir el pago del extracto";
    return { success: false, error: message };
  }
}

/**
 * Obtiene el registro de extracto de una tarjeta para un mes dado.
 */
export async function getStatementByMonth(
  creditCardAccountId: string,
  statementMonth: string
): Promise<ActionResult<CreditCardStatementRow | null>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const { data: statement, error } = await supabase
      .from("credit_card_statements")
      .select("*")
      .eq("account_id", creditCardAccountId)
      .eq("statement_month", statementMonth)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    return { success: true, data: statement };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while fetching statement";
    return { success: false, error: message };
  }
}

/**
 * Lista todos los extractos registrados de todas las tarjetas del usuario autenticado.
 */
export async function listAllStatements(): Promise<ActionResult<CreditCardStatementRow[]>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const { data: statements, error } = await supabase
      .from("credit_card_statements")
      .select("*")
      .eq("user_id", user.id)
      .order("statement_month", { ascending: false });

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    return { success: true, data: statements || [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while listing all statements";
    return { success: false, error: message };
  }
}

/**
 * Lista todos los extractos registrados de una tarjeta de crédito.
 */
export async function listStatements(
  creditCardAccountId: string
): Promise<ActionResult<CreditCardStatementRow[]>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    const { data: statements, error } = await supabase
      .from("credit_card_statements")
      .select("*")
      .eq("account_id", creditCardAccountId)
      .eq("user_id", user.id)
      .order("statement_month", { ascending: false });

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    return { success: true, data: statements || [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while listing statements";
    return { success: false, error: message };
  }
}

export interface PaymentAlert {
  id: string;
  cardId: string;
  cardName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  daysRemaining: number;
  status: "overdue" | "due_today" | "upcoming";
  statementMonth?: string;
  isPaid: boolean;
}

/**
 * Obtiene las alertas de fechas límite de pago y extractos pendientes para las tarjetas de crédito del usuario.
 */
export async function getPaymentAlerts(): Promise<ActionResult<PaymentAlert[]>> {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: User is not authenticated" };
    }

    // 1. Obtener tarjetas de crédito activas
    const { data: cards, error: cardsError } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_type", "credit_card")
      .eq("is_active", true);

    if (cardsError) {
      return { success: false, error: `Database error while fetching cards: ${cardsError.message}` };
    }

    // 2. Obtener extractos registrados
    const { data: statements } = await supabase
      .from("credit_card_statements")
      .select("*")
      .eq("user_id", user.id);

    const now = new Date();
    const todayDate = formatCivilDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const alerts: PaymentAlert[] = [];

    for (const card of cards || []) {
      const cardDebt = Number(card.current_balance) || 0;
      const closingDay = card.closing_day || 15;
      const paymentDueDay = card.payment_due_day || 5;

      // Calcular ciclo actual y fecha límite de pago
      const currentClosingDate = calculateStatementClosingDate(todayDate, closingDay);
      const currentDueDate = calculatePaymentDueDate(currentClosingDate, closingDay, paymentDueDay);
      const { year, month } = parseCivilDate(currentClosingDate);
      const statementMonth = `${year}-${String(month).padStart(2, "0")}`;

      // Verificar si el extracto ya está pagado
      const isPaid = statements?.some(
        (s) => s.account_id === card.id && s.statement_month === statementMonth && s.is_paid
      );

      // Si la tarjeta tiene deuda acumulada y no ha sido saldada
      if (cardDebt > 0 && !isPaid) {
        const daysRemaining = diffCivilDays(todayDate, currentDueDate);
        let status: "overdue" | "due_today" | "upcoming" = "upcoming";

        if (daysRemaining < 0) {
          status = "overdue";
        } else if (daysRemaining === 0) {
          status = "due_today";
        }

        alerts.push({
          id: `${card.id}_${statementMonth}`,
          cardId: card.id,
          cardName: card.name,
          amount: cardDebt,
          dueDate: currentDueDate,
          daysRemaining,
          status,
          statementMonth,
          isPaid: false,
        });
      }
    }

    // Ordenar: vencidos primero, luego los que vencen hoy, luego por días restantes ascendente
    alerts.sort((a, b) => {
      const priority = { overdue: 1, due_today: 2, upcoming: 3 };
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      return a.daysRemaining - b.daysRemaining;
    });

    return { success: true, data: alerts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while fetching payment alerts";
    return { success: false, error: message };
  }
}

