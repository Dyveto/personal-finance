import { roundMoney, compareMoney } from "./money";
import type { ManagementFeeType } from "@/types/database.types";

export interface ManagementFeeEvaluationInput {
  /**
   * Valor base de la cuota de manejo en COP.
   * Por ejemplo: 12000 o "12000.00" (Nu), o 0 si no aplica.
   */
  feeAmount: string | number;
  /**
   * Modalidad de cobro de la tarjeta de crédito:
   * - 'fixed_monthly': Cobro mensual fijo (se cobra todos los meses, se use o no la tarjeta).
   * - 'only_on_use': Cobro condicionado (solo en meses en que hubo consumo o saldo).
   * - 'exempt_if_used': Exoneración por uso (sin cobro si se registra consumo en el mes).
   * - 'exempt': Exenta permanente / Sin cuota de manejo ($0).
   */
  feeType: ManagementFeeType;
  /**
   * Indica si se registraron compras, movimientos o saldo adeudado en el ciclo/mes.
   */
  hasUsageInPeriod: boolean;
}

export interface ManagementFeeEvaluationResult {
  /**
   * Indica si en este período debe liquidarse y cobrarse la cuota de manejo.
   */
  applies: boolean;
  /**
   * Importe monetario a liquidar en formato decimal exacto COP (NUMERIC(12,2)).
   */
  calculatedFee: string;
  /**
   * Modalidad evaluada.
   */
  feeType: ManagementFeeType;
  /**
   * Explicación descriptiva para auditoría y visualización de usuario.
   */
  reason: string;
}

/**
 * Evalúa con precisión decimal y reglas deterministas si aplica la cuota de manejo
 * a una tarjeta de crédito en un período de facturación según la modalidad acordada.
 */
export function evaluateManagementFee(
  input: ManagementFeeEvaluationInput
): ManagementFeeEvaluationResult {
  const normalizedFee = roundMoney(input.feeAmount ?? 0);
  const isZero = compareMoney(normalizedFee, "0.00") <= 0;

  // 1. Tarjeta exenta permanentemente o sin cuota configurada
  if (input.feeType === "exempt" || isZero) {
    return {
      applies: false,
      calculatedFee: "0.00",
      feeType: input.feeType,
      reason: "Tarjeta exenta de cuota de manejo.",
    };
  }

  // 2. Modalidad mensual fija (se use o no la tarjeta; ej. Nu con $12.000 COP)
  if (input.feeType === "fixed_monthly") {
    return {
      applies: true,
      calculatedFee: normalizedFee,
      feeType: input.feeType,
      reason: "Cobro mensual fijo aplicado independientemente del uso.",
    };
  }

  // 3. Modalidad cobro solo si se usa en el período
  if (input.feeType === "only_on_use") {
    if (input.hasUsageInPeriod) {
      return {
        applies: true,
        calculatedFee: normalizedFee,
        feeType: input.feeType,
        reason: "Cuota de manejo aplicada por registrar uso en el período.",
      };
    }
    return {
      applies: false,
      calculatedFee: "0.00",
      feeType: input.feeType,
      reason: "Sin cobro de cuota de manejo: no se registró uso ni saldo en el período.",
    };
  }

  // 4. Modalidad exenta si se usa (cobra solo si no se registra uso en el período)
  if (input.feeType === "exempt_if_used") {
    if (input.hasUsageInPeriod) {
      return {
        applies: false,
        calculatedFee: "0.00",
        feeType: input.feeType,
        reason: "Exonerada de cuota de manejo por registrar uso en el período.",
      };
    }
    return {
      applies: true,
      calculatedFee: normalizedFee,
      feeType: input.feeType,
      reason: "Cuota de manejo aplicada por no registrar el uso mínimo requerido.",
    };
  }

  // Fallback seguro
  return {
    applies: false,
    calculatedFee: "0.00",
    feeType: "exempt",
    reason: "Modalidad no reconocida, exenta por defecto.",
  };
}
