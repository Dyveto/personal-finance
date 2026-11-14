/**
 * Utilidades para manejo de fechas civiles (YYYY-MM-DD) y ciclos de facturación
 * de tarjetas de crédito sin dependencias de conversiones UTC accidentales.
 * Timezone de referencia: America/Bogota.
 */

export interface CivilDate {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
}

/**
 * Determina si un año es bisiesto según el calendario gregoriano.
 *
 * @param year Año a evaluar (ej. 2024, 2026, 2028).
 * @returns true si es bisiesto, false en caso contrario.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Obtiene el número exacto de días en un mes específico de un año.
 *
 * @param year Año (ej. 2026).
 * @param month Mes (1 a 12).
 * @returns Número total de días (28, 29, 30 o 31).
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be between 1 and 12.`);
  }

  switch (month) {
    case 1: // Enero
    case 3: // Marzo
    case 5: // Mayo
    case 7: // Julio
    case 8: // Agosto
    case 10: // Octubre
    case 12: // Diciembre
      return 31;
    case 4: // Abril
    case 6: // Junio
    case 9: // Septiembre
    case 11: // Noviembre
      return 30;
    case 2: // Febrero
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new Error(`Unexpected month: ${month}`);
  }
}

/**
 * Parsea una cadena de fecha civil en formato ISO "YYYY-MM-DD" a sus componentes numéricos.
 * No utiliza `new Date()` para evitar desfases de zona horaria o conversiones UTC.
 *
 * @param dateStr Cadena en formato YYYY-MM-DD.
 * @returns Objeto CivilDate con year, month y day.
 */
export function parseCivilDate(dateStr: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid civil date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in date "${dateStr}": ${month}. Must be 1-12.`);
  }

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    throw new Error(
      `Invalid day in date "${dateStr}": ${day}. Month ${month}/${year} has ${maxDays} days.`
    );
  }

  return { year, month, day };
}

/**
 * Formatea componentes de fecha civil a una cadena ISO "YYYY-MM-DD".
 *
 * @param year Año.
 * @param month Mes (1-12).
 * @param day Día (1-31).
 * @returns Cadena formateada YYYY-MM-DD.
 */
export function formatCivilDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Ajusta un día de corte o pago al máximo día válido de un mes si el mes es más corto.
 *
 * @param year Año.
 * @param month Mes (1-12).
 * @param targetDay Día deseado (1-31).
 * @returns Día ajustado (ej. 31 en febrero 2027 se convierte en 28).
 */
export function clampDayToMonth(year: number, month: number, targetDay: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.min(targetDay, maxDays);
}

/**
 * Suma una cantidad de meses a un año y mes civil, manejando el cambio de año.
 *
 * @param year Año inicial.
 * @param month Mes inicial (1-12).
 * @param monthsToAdd Número de meses a sumar (puede ser 0 o positivo).
 * @returns Nuevo año y mes.
 */
export function addMonths(
  year: number,
  month: number,
  monthsToAdd: number
): { year: number; month: number } {
  const totalMonths = month - 1 + monthsToAdd;
  const newYear = year + Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return { year: newYear, month: newMonth };
}

/**
 * Calcula la fecha de corte (statement closing date) para una compra en tarjeta de crédito.
 *
 * Reglas de negocio:
 * 1. Si el día de la compra es <= closing_day: la fecha de corte pertenece al mismo mes de la compra.
 * 2. Si el día de la compra es > closing_day: la fecha de corte pertenece al mes siguiente.
 * 3. Si el día configurado no existe en el mes destino (ej. día 31 en febrero o abril),
 *    se ajusta al último día válido de ese mes.
 *
 * @param purchaseDate Fecha de la compra en formato ISO "YYYY-MM-DD".
 * @param closingDay Día de corte de la tarjeta (1 a 31).
 * @returns Fecha de corte en formato ISO "YYYY-MM-DD".
 *
 * @example
 * calculateStatementClosingDate("2026-03-15", 20) // "2026-03-20"
 * calculateStatementClosingDate("2026-03-20", 20) // "2026-03-20"
 * calculateStatementClosingDate("2026-03-21", 20) // "2026-04-20"
 * calculateStatementClosingDate("2027-02-10", 31) // "2027-02-28"
 */
export function calculateStatementClosingDate(
  purchaseDate: string,
  closingDay: number
): string {
  if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
    throw new Error(`closingDay must be an integer between 1 and 31, received: ${closingDay}`);
  }

  const { year, month, day } = parseCivilDate(purchaseDate);

  let targetYear = year;
  let targetMonth = month;

  // Si el día de compra superó el día de corte, el extracto cierra en el siguiente mes
  if (day > closingDay) {
    const next = addMonths(year, month, 1);
    targetYear = next.year;
    targetMonth = next.month;
  }

  const finalDay = clampDayToMonth(targetYear, targetMonth, closingDay);
  return formatCivilDate(targetYear, targetMonth, finalDay);
}

/**
 * Calcula la fecha límite de pago (payment due date) a partir de la fecha de corte calculada.
 *
 * Reglas de negocio:
 * 1. Si payment_due_day > closing_day: el pago vence en el mismo mes del corte.
 * 2. Si payment_due_day <= closing_day: el pago vence en el mes inmediatamente siguiente al corte.
 * 3. Se ajusta al último día calendario válido del mes de vencimiento si el mes tiene menos días.
 *
 * @param closingDate Fecha de corte calculada en formato ISO "YYYY-MM-DD".
 * @param closingDay Día de corte configurado de la tarjeta (1 a 31).
 * @param paymentDueDay Día límite de pago configurado de la tarjeta (1 a 31).
 * @returns Fecha límite de pago en formato ISO "YYYY-MM-DD".
 *
 * @example
 * calculatePaymentDueDate("2026-03-20", 20, 5)  // "2026-04-05" (5 <= 20 -> mes siguiente)
 * calculatePaymentDueDate("2026-03-05", 5, 25)  // "2026-03-25" (25 > 5  -> mismo mes)
 * calculatePaymentDueDate("2027-02-28", 31, 31) // "2027-03-31" (31 <= 31 -> mes siguiente)
 */
export function calculatePaymentDueDate(
  closingDate: string,
  closingDay: number,
  paymentDueDay: number
): string {
  if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
    throw new Error(`closingDay must be an integer between 1 and 31, received: ${closingDay}`);
  }

  if (!Number.isInteger(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 31) {
    throw new Error(
      `paymentDueDay must be an integer between 1 and 31, received: ${paymentDueDay}`
    );
  }

  const { year: closingYear, month: closingMonth } = parseCivilDate(closingDate);

  let dueYear = closingYear;
  let dueMonth = closingMonth;

  // Si el día de pago es menor o igual al día de corte, vence en el mes siguiente
  if (paymentDueDay <= closingDay) {
    const next = addMonths(closingYear, closingMonth, 1);
    dueYear = next.year;
    dueMonth = next.month;
  }

  const finalDay = clampDayToMonth(dueYear, dueMonth, paymentDueDay);
  return formatCivilDate(dueYear, dueMonth, finalDay);
}
