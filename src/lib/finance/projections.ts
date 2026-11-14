import { splitInstallments, roundMoney } from "@/lib/finance/money";
import {
  calculateStatementClosingDate,
  calculatePaymentDueDate,
  parseCivilDate,
  formatCivilDate,
  clampDayToMonth,
  addMonths,
} from "@/lib/finance/calendar";

export interface ProjectedInstallment {
  transactionId: string;
  description: string;
  accountName: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: string;
  closingDate: string;
  paymentDueDate: string;
  statementMonth: string; // "YYYY-MM"
}

export interface MonthlyProjectionSummary {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "Mar 2027"
  totalProjectedAmount: string;
  installments: ProjectedInstallment[];
}

/**
 * Genera la proyección mensual de cuotas para una compra en tarjeta de crédito.
 *
 * @param transaction Objeto con datos de la transacción diferida.
 * @param card Cuenta de tarjeta de crédito asociada con días de corte y pago.
 * @returns Array de cuotas proyectadas mes a mes.
 */
export function projectTransactionInstallments(
  transaction: {
    id: string;
    description: string;
    amount: number | string;
    transaction_date: string;
    is_installment: boolean;
    installment_count: number;
  },
  card: {
    name: string;
    closing_day: number;
    payment_due_day: number;
  }
): ProjectedInstallment[] {
  const count = transaction.installment_count || 1;
  const amountStr = roundMoney(transaction.amount);

  // 1. Dividir las cuotas con exactitud decimal y conservación de centavos
  const installmentAmounts = splitInstallments(amountStr, count);

  // 2. Determinar la fecha de corte inicial a partir de la fecha de compra
  const firstClosingDate = calculateStatementClosingDate(
    transaction.transaction_date,
    card.closing_day
  );
  const { year: baseYear, month: baseMonth } = parseCivilDate(firstClosingDate);

  const projections: ProjectedInstallment[] = [];

  for (let i = 0; i < count; i++) {
    const { year: targetYear, month: targetMonth } = addMonths(baseYear, baseMonth, i);
    const targetDay = clampDayToMonth(targetYear, targetMonth, card.closing_day);
    const closingDate = formatCivilDate(targetYear, targetMonth, targetDay);
    const paymentDueDate = calculatePaymentDueDate(
      closingDate,
      card.closing_day,
      card.payment_due_day
    );
    const statementMonth = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;

    projections.push({
      transactionId: transaction.id,
      description: transaction.description,
      accountName: card.name,
      installmentNumber: i + 1,
      totalInstallments: count,
      amount: installmentAmounts[i],
      closingDate,
      paymentDueDate,
      statementMonth,
    });
  }

  return projections;
}
