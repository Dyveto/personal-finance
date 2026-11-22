import Decimal from "decimal.js";
import { roundMoney, addMoney } from "./money";

export const FOUR_PER_THOUSAND_RATE = new Decimal(0.004); // 4 / 1000 = 0.4%

/**
 * Calcula con precisión decimal estricta en COP el valor del impuesto 4x1000 (0.4% o 4 por cada mil).
 *
 * @param baseAmount Monto base del egreso/transferencia en COP.
 * @param isTaxed Indica si la cuenta origen está gravada con 4x1000 (true) o exenta (false).
 * @param transactionType Tipo de transacción ('expense' aplica; 'income' no aplica).
 * @returns Valor del impuesto en COP con exactamente dos decimales (ej. "400.00" o "0.00").
 */
export function calculateFourPerThousand(
  baseAmount: number | string | Decimal,
  isTaxed: boolean = true,
  transactionType: string = "expense"
): string {
  if (!isTaxed || transactionType !== "expense") {
    return "0.00";
  }

  try {
    const dec = new Decimal(baseAmount);
    if (!dec.isFinite() || dec.isNegative()) {
      return "0.00";
    }
    return dec.times(FOUR_PER_THOUSAND_RATE).toFixed(2, Decimal.ROUND_HALF_UP);
  } catch {
    return "0.00";
  }
}

export interface FourPerThousandBreakdown {
  baseAmount: string;
  fourPerThousand: string;
  totalAmount: string;
  isTaxed: boolean;
}

/**
 * Genera el desglose exacto entre monto base, valor de 4x1000 y monto total debitado de la cuenta.
 *
 * @param baseAmount Monto base de la operación en COP.
 * @param isTaxed Si la cuenta está gravada.
 * @param transactionType Tipo de movimiento.
 * @returns Objeto con baseAmount, fourPerThousand, totalAmount e isTaxed.
 */
export function breakdownFourPerThousand(
  baseAmount: number | string | Decimal,
  isTaxed: boolean = true,
  transactionType: string = "expense"
): FourPerThousandBreakdown {
  const baseStr = roundMoney(baseAmount);
  const feeStr = calculateFourPerThousand(baseStr, isTaxed, transactionType);
  const totalStr = addMoney(baseStr, feeStr);

  return {
    baseAmount: baseStr,
    fourPerThousand: feeStr,
    totalAmount: totalStr,
    isTaxed: isTaxed && transactionType === "expense" && feeStr !== "0.00",
  };
}
