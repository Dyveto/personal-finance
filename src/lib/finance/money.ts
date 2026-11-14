import Decimal from "decimal.js";

// Configuración global para operaciones financieras
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Valida y formatea un valor numérico a un string con exactamente dos decimales.
 * Aplica redondeo bancario estándar (ROUND_HALF_UP).
 *
 * @param amount Monto a redondear (string, number o Decimal).
 * @returns Monto formateado con exactamente dos decimales (ej. "15000.00").
 * @throws Error si el monto no es un número válido o es negativo cuando no está permitido.
 */
export function roundMoney(amount: string | number | Decimal): string {
  try {
    const dec = new Decimal(amount);
    if (!dec.isFinite()) {
      throw new Error(`Invalid non-finite amount: "${String(amount)}"`);
    }
    return dec.toFixed(2, Decimal.ROUND_HALF_UP);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid")) {
      throw err;
    }
    throw new Error(`Failed to parse monetary amount: "${String(amount)}"`);
  }
}

/**
 * Divide una compra en un número de cuotas garantizando que:
 * 1. Cada cuota tenga exactamente dos decimales.
 * 2. La suma exacta de las cuotas sea idéntica al monto original.
 * 3. Cualquier centavo sobrante por redondeo se asigne a la primera cuota.
 *
 * @param amount Monto total de la compra (string, ej. "100000.00").
 * @param installmentCount Número de cuotas (entero >= 1).
 * @returns Array de strings con los montos de cada cuota.
 *
 * @example
 * splitInstallments("100000", 3)
 * // Retorna: ["33333.34", "33333.33", "33333.33"]
 */
export function splitInstallments(amount: string, installmentCount: number): string[] {
  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    throw new Error(`installmentCount must be an integer >= 1, received: ${installmentCount}`);
  }

  const total = new Decimal(amount);
  if (!total.isFinite() || total.isNegative()) {
    throw new Error(`Purchase amount must be a positive finite number, received: "${amount}"`);
  }

  // Redondear total a dos decimales exactos
  const normalizedTotal = new Decimal(roundMoney(total));

  if (installmentCount === 1) {
    return [normalizedTotal.toFixed(2)];
  }

  // Cuota base redondeada hacia abajo a 2 decimales para no exceder el total
  const baseInstallment = normalizedTotal
    .dividedBy(installmentCount)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);

  // Suma de las cuotas subsiguientes (cuota 2 hasta N)
  const remainingInstallmentsSum = baseInstallment.times(installmentCount - 1);

  // La primera cuota absorbe el centavo o residuo restante
  const firstInstallment = normalizedTotal.minus(remainingInstallmentsSum);

  const result: string[] = [firstInstallment.toFixed(2)];
  const baseStr = baseInstallment.toFixed(2);

  for (let i = 1; i < installmentCount; i++) {
    result.push(baseStr);
  }

  return result;
}

/**
 * Suma una lista de valores monetarios con precisión decimal exacta.
 *
 * @param amounts Valores en formato string.
 * @returns Suma total en string con 2 decimales.
 */
export function addMoney(...amounts: string[]): string {
  let total = new Decimal(0);
  for (const amt of amounts) {
    total = total.plus(new Decimal(amt));
  }
  return total.toFixed(2, Decimal.ROUND_HALF_UP);
}

/**
 * Resta subtrahend de minuend con precisión decimal exacta (minuend - subtrahend).
 *
 * @param minuend Monto base.
 * @param subtrahend Monto a restar.
 * @returns Resultado en string con 2 decimales.
 */
export function subtractMoney(minuend: string, subtrahend: string): string {
  const result = new Decimal(minuend).minus(new Decimal(subtrahend));
  return result.toFixed(2, Decimal.ROUND_HALF_UP);
}

/**
 * Multiplica un monto por un factor multiplicativo.
 *
 * @param amount Monto base en string.
 * @param factor Factor numérico o string.
 * @returns Resultado en string con 2 decimales.
 */
export function multiplyMoney(amount: string, factor: string | number): string {
  const result = new Decimal(amount).times(new Decimal(factor));
  return result.toFixed(2, Decimal.ROUND_HALF_UP);
}

/**
 * Compara dos montos monetarios.
 *
 * @param a Primer monto.
 * @param b Segundo monto.
 * @returns -1 si a < b, 0 si a == b, 1 si a > b.
 */
export function compareMoney(a: string, b: string): number {
  return new Decimal(a).comparedTo(new Decimal(b));
}

/**
 * Verifica si un monto es estrictamente positivo (> 0).
 *
 * @param amount Monto a evaluar.
 * @returns true si amount > 0.
 */
export function isPositiveMoney(amount: string): boolean {
  try {
    const dec = new Decimal(amount);
    return dec.isFinite() && dec.greaterThan(0);
  } catch {
    return false;
  }
}

/**
 * Formatea un valor monetario en Pesos Colombianos (COP) para visualización en UI.
 *
 * @param amount Monto a formatear.
 * @param options Opciones de formato.
 * @returns Cadena formateada (ej. "$ 100.000,00" o "$ 100.000").
 */
export function formatMoneyCOP(
  amount: string | number | Decimal,
  options: { includeDecimals?: boolean; includeSymbol?: boolean } = {}
): string {
  const { includeDecimals = true, includeSymbol = true } = options;
  const dec = new Decimal(amount);
  const numValue = dec.toNumber();

  const formatter = new Intl.NumberFormat("es-CO", {
    style: includeSymbol ? "currency" : "decimal",
    currency: "COP",
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  });

  return formatter.format(numValue);
}
