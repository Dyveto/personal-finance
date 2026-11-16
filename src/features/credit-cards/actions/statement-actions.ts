"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MarkExtractAsPaidSchema,
  type MarkExtractAsPaidInput,
} from "@/lib/validations/finance";
import { addMoney, subtractMoney, roundMoney } from "@/lib/finance/money";
import {
  calculateStatementClosingDate,
  calculatePaymentDueDate,
  parseCivilDate,
  formatCivilDate,
  clampDayToMonth,
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

    const { data: statementRecord, error: stmtError } = await supabase
      .from("credit_card_statements")
      .upsert(
        {
          user_id: user.id,
          account_id: card.id,
          statement_month: validated.statementMonth,
          closing_date: closingDate,
          due_date: dueDate,
          total_amount: finalAmountNum,
          is_paid: true,
          paid_at: new Date().toISOString(),
          notes:
            validated.notes ??
            (paymentAccount
              ? `Pagado mediante cuenta ${paymentAccount.name}`
              : "Extracto registrado como pagado"),
        },
        { onConflict: "user_id,account_id,statement_month" }
      )
      .select()
      .single();

    if (stmtError) {
      return { success: false, error: `Failed to record credit card statement: ${stmtError.message}` };
    }

    // 6. Reducir deuda acumulada de la tarjeta de crédito
    const currentCardDebt = roundMoney(card.current_balance);
    const newCardDebt = Math.max(0, parseFloat(subtractMoney(currentCardDebt, finalAmountStr)));

    const { error: cardBalError } = await supabase
      .from("accounts")
      .update({ current_balance: newCardDebt })
      .eq("id", card.id)
      .eq("user_id", user.id);

    if (cardBalError) {
      return { success: false, error: `Failed to update card balance: ${cardBalError.message}` };
    }

    // 7. Si se proporcionó cuenta de pago y el monto es mayor a 0, debitar y registrar movimiento
    if (paymentAccount && finalAmountNum > 0) {
      const currentPayBal = roundMoney(paymentAccount.current_balance);
      const newPayBal = parseFloat(subtractMoney(currentPayBal, finalAmountStr));

      const { error: payBalError } = await supabase
        .from("accounts")
        .update({ current_balance: newPayBal })
        .eq("id", paymentAccount.id)
        .eq("user_id", user.id);

      if (payBalError) {
        return {
          success: false,
          error: `Statement marked as paid, but failed to debit payment account: ${payBalError.message}`,
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

        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: paymentAccount.id,
          category_id: categoryId,
          description: `Pago extracto tarjeta ${card.name} (${validated.statementMonth})`,
          amount: finalAmountNum,
          transaction_type: "expense",
          transaction_date: todayDate,
          is_installment: false,
          installment_count: 1,
          is_paid: true,
          paid_at: new Date().toISOString(),
          notes: `Pago registrado automáticamente para el extracto de ${card.name}`,
        });
      }
    }

    revalidatePath("/credit-cards");
    revalidatePath("/accounts");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return {
      success: true,
      data: {
        statement: statementRecord,
        amountPaid: finalAmountNum,
        updatedTransactionsCount: txIdsToMarkPaid.length,
        paymentAccountId: paymentAccount?.id ?? null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while marking statement as paid";
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
