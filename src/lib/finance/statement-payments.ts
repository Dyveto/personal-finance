import {
  roundMoney,
  addMoney,
  compareMoney,
} from "./money";
import {
  evaluateManagementFee,
} from "./management-fee";
import type { ManagementFeeType } from "@/types/database.types";

export interface StatementPaymentCalculationInput {
  /**
   * Suma total de las cuotas diferidas y consumos activos del extracto del período en COP.
   */
  periodInstallmentsTotal: number | string;
  /**
   * Saldo total adeudado acumulado en la tarjeta de crédito en COP (card.current_balance).
   */
  totalCardDebt: number | string;
  /**
   * Valor base configurado de cuota de manejo en COP.
   */
  managementFeeAmount?: number | string | null;
  /**
   * Modalidad de cuota de manejo de la tarjeta.
   */
  managementFeeType?: ManagementFeeType | null;
  /**
   * Indica si se registraron compras o saldo en el período para evaluación de cuota de manejo.
   */
  hasUsageInPeriod?: boolean;
}

export interface StatementPaymentCalculationResult {
  /**
   * Monto del pago mínimo sugerido en COP (cuotas del mes + cuota de manejo si aplica, topado a la deuda total).
   */
  minimumPayment: string;
  /**
   * Monto del pago total en COP (igual a la deuda total de la tarjeta).
   */
  fullPayment: string;
  /**
   * Monto máximo permitido para cualquier pago (igual a la deuda total de la tarjeta).
   */
  maxAllowedPayment: string;
  /**
   * Monto de cuota de manejo aplicada e incluida en el cálculo en COP.
   */
  managementFeeApplied: string;
  /**
   * Indica si la cuota de manejo aplicó en este período.
   */
  managementFeeIncluded: boolean;
  /**
   * Razón de la cuota de manejo para visualización o auditoría.
   */
  managementFeeReason: string;
  /**
   * Indica si la tarjeta tiene saldo adeudado (> 0).
   */
  hasDebt: boolean;
}

/**
 * Calcula con precisión decimal estricta en COP las opciones de pago para un extracto de tarjeta:
 * 1. Pago mínimo: cuotas del mes + cuota de manejo aplicable (topado a la deuda total de la tarjeta).
 * 2. Pago total: deuda total acumulada de la tarjeta.
 * 3. Máximo permitido: nunca puede superar la deuda total acumulada de la tarjeta.
 */
export function calculateStatementPaymentOptions(
  input: StatementPaymentCalculationInput
): StatementPaymentCalculationResult {
  const cardDebt = roundMoney(Math.max(0, Number(input.totalCardDebt ?? 0)));
  const installmentsTotal = roundMoney(Math.max(0, Number(input.periodInstallmentsTotal ?? 0)));
  const hasDebt = compareMoney(cardDebt, "0.00") > 0;

  // 1. Evaluar si aplica cuota de manejo
  let feeApplied = "0.00";
  let feeIncluded = false;
  let feeReason = "Sin cuota de manejo";

  if (input.managementFeeType && input.managementFeeAmount !== undefined && input.managementFeeAmount !== null) {
    const feeEval = evaluateManagementFee({
      feeAmount: input.managementFeeAmount,
      feeType: input.managementFeeType,
      hasUsageInPeriod: input.hasUsageInPeriod ?? true,
    });
    if (feeEval.applies) {
      feeApplied = feeEval.calculatedFee;
      feeIncluded = true;
      feeReason = feeEval.reason;
    } else {
      feeReason = feeEval.reason;
    }
  }

  // 2. Calcular pago mínimo: cuotas del mes + cuota de manejo aplicada
  const rawMinimum = addMoney(installmentsTotal, feeApplied);

  // El pago mínimo nunca puede exceder la deuda total de la tarjeta
  // Si la tarjeta no tiene deuda, el mínimo es 0.00
  let minimumPayment: string;
  if (!hasDebt) {
    minimumPayment = "0.00";
  } else if (compareMoney(rawMinimum, cardDebt) > 0) {
    minimumPayment = cardDebt;
  } else if (compareMoney(rawMinimum, "0.00") <= 0) {
    // Si no había cuotas en el mes pero hay deuda en la tarjeta, el mínimo se establece en la deuda o un mínimo razonable
    minimumPayment = cardDebt;
  } else {
    minimumPayment = rawMinimum;
  }

  return {
    minimumPayment,
    fullPayment: cardDebt,
    maxAllowedPayment: cardDebt,
    managementFeeApplied: feeApplied,
    managementFeeIncluded: feeIncluded,
    managementFeeReason: feeReason,
    hasDebt,
  };
}

/**
 * Valida si un monto personalizado es legal:
 * - Debe ser > 0.
 * - Debe ser <= deuda total de la tarjeta.
 */
export function validateCustomPaymentAmount(
  amount: number | string,
  totalCardDebt: number | string
): { isValid: boolean; error?: string; normalizedAmount: string } {
  const amountStr = roundMoney(amount);
  const debtStr = roundMoney(Math.max(0, Number(totalCardDebt ?? 0)));

  if (compareMoney(amountStr, "0.00") <= 0) {
    return {
      isValid: false,
      error: "El monto a pagar debe ser mayor a 0 COP.",
      normalizedAmount: "0.00",
    };
  }

  if (compareMoney(amountStr, debtStr) > 0) {
    return {
      isValid: false,
      error: `El monto no puede superar la deuda total de la tarjeta (${debtStr} COP).`,
      normalizedAmount: amountStr,
    };
  }

  return {
    isValid: true,
    normalizedAmount: amountStr,
  };
}
