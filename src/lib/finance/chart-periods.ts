/**
 * Motor puro de cálculo y navegación temporal para gráficos del Dashboard financiero.
 * Maneja granularidades (días, semanas, meses, años, personalizado), cantidades configurables,
 * límites y desplazamiento temporal (offset hacia el pasado).
 *
 * Zona horaria de referencia: America/Bogota
 */

export type ChartGranularity = "days" | "weeks" | "months" | "years" | "custom";

export interface TimeBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface ComputedTimeWindow {
  granularity: ChartGranularity;
  quantity: number;
  offset: number;
  startDateLimit: string;
  endDateLimit: string;
  summaryLabel: string;
  periodDescription: string;
  isCurrentPeriod: boolean;
  buckets: TimeBucket[];
}

export const MONTH_NAMES_ES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

export const MONTH_NAMES_ES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const DEFAULT_QUANTITIES: Record<ChartGranularity, number> = {
  days: 14,
  weeks: 4,    // Requerimiento: 4 por defecto en lugar de 8
  months: 6,   // Requerimiento: 6 por defecto, editable a 1, 3, 12, etc.
  years: 3,
  custom: 30,
};

export const QUANTITY_LIMITS: Record<ChartGranularity, { min: number; max: number }> = {
  days: { min: 1, max: 60 },
  weeks: { min: 1, max: 24 },
  months: { min: 1, max: 24 },
  years: { min: 1, max: 5 },
  custom: { min: 1, max: 365 },
};

/**
 * Valida y restringe la cantidad dentro de los límites seguros de la granularidad.
 */
export function clampQuantity(granularity: ChartGranularity, qty: number): number {
  if (granularity === "custom") return 30;
  const limits = QUANTITY_LIMITS[granularity];
  if (!limits) return 1;
  if (isNaN(qty) || qty < limits.min) return limits.min;
  if (qty > limits.max) return limits.max;
  return Math.floor(qty);
}

/**
 * Obtiene la fecha civil en formato ISO YYYY-MM-DD para una fecha dada.
 */
export function formatCivilDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Obtiene la fecha actual en America/Bogota como un objeto Date sin desfases UTC.
 */
export function getNowBogota(referenceDate?: Date | string): Date {
  if (referenceDate) {
    if (typeof referenceDate === "string") {
      const parts = referenceDate.split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2] || 1);
    }
    return new Date(referenceDate.getTime());
  }

  // Si no se provee, usar fecha civil actual en Colombia
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(new Date()).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export interface ComputeWindowOptions {
  granularity: ChartGranularity;
  quantity?: number;
  offset?: number;
  referenceDate?: Date | string;
  customStartDate?: string;
  customEndDate?: string;
}

/**
 * Calcula la ventana temporal determinista y sus cubetas de agregación.
 */
export function computeTimeWindow(options: ComputeWindowOptions): ComputedTimeWindow {
  const {
    granularity,
    customStartDate,
    customEndDate,
  } = options;

  const offset = Math.max(0, Math.floor(options.offset || 0));
  const rawQty = options.quantity ?? DEFAULT_QUANTITIES[granularity];
  const quantity = clampQuantity(granularity, rawQty);
  const now = getNowBogota(options.referenceDate);
  const isCurrentPeriod = offset === 0;

  if (granularity === "custom") {
    const startStr = customStartDate || "2000-01-01";
    const endStr = customEndDate || formatCivilDateISO(now);
    return {
      granularity: "custom",
      quantity: 1,
      offset: 0,
      startDateLimit: startStr,
      endDateLimit: endStr,
      summaryLabel: `Rango: ${startStr} al ${endStr}`,
      periodDescription: "Rango personalizado",
      isCurrentPeriod: true,
      buckets: [],
    };
  }

  if (granularity === "months") {
    // Si la cantidad es 1 mes, cada offset desplaza exactamente 1 mes hacia atrás.
    // Si la cantidad es N meses, la ventana cubre N meses finalizando en (now - offset meses).
    const endMonthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const startMonthDate = new Date(
      endMonthDate.getFullYear(),
      endMonthDate.getMonth() - (quantity - 1),
      1
    );

    // Último día del mes de finalización
    const lastDayOfMonth = new Date(
      endMonthDate.getFullYear(),
      endMonthDate.getMonth() + 1,
      0
    ).getDate();

    const startDateLimit = formatCivilDateISO(startMonthDate);
    // Si el mes final es el mes actual y offset === 0, podemos cubrir todo el mes o hasta fin de mes para proyecciones
    const endDateLimit = `${endMonthDate.getFullYear()}-${String(endMonthDate.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

    // Construcción de cubetas (una por cada mes en orden cronológico)
    const buckets: TimeBucket[] = [];
    for (let i = quantity - 1; i >= 0; i--) {
      const d = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const mLabel = quantity === 1
        ? `${MONTH_NAMES_ES_LONG[d.getMonth()]} ${d.getFullYear()}`
        : `${MONTH_NAMES_ES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
      buckets.push({
        key: mKey,
        label: mLabel,
        startDate: `${mKey}-01`,
        endDate: `${mKey}-${String(lastDay).padStart(2, "0")}`,
      });
    }

    let summaryLabel: string;
    let periodDescription: string;

    if (quantity === 1) {
      const monthName = MONTH_NAMES_ES_LONG[endMonthDate.getMonth()];
      summaryLabel = `${monthName} ${endMonthDate.getFullYear()}`;
      periodDescription = isCurrentPeriod ? "Mes en curso" : `Histórico (${monthName})`;
    } else {
      const startName = MONTH_NAMES_ES_SHORT[startMonthDate.getMonth()];
      const endName = MONTH_NAMES_ES_SHORT[endMonthDate.getMonth()];
      summaryLabel = `${startName} ${startMonthDate.getFullYear()} - ${endName} ${endMonthDate.getFullYear()} (${quantity} meses)`;
      periodDescription = isCurrentPeriod ? `Últimos ${quantity} meses` : `Ventana de ${quantity} meses`;
    }

    return {
      granularity: "months",
      quantity,
      offset,
      startDateLimit,
      endDateLimit,
      summaryLabel,
      periodDescription,
      isCurrentPeriod,
      buckets,
    };
  }

  if (granularity === "weeks") {
    // Cada paso de offset desplaza la ventana hacia atrás en múltiplos de semanas
    const endDaysAgo = offset * 7;
    const startDaysAgo = endDaysAgo + quantity * 7 - 1;

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - endDaysAgo);

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - startDaysAgo);

    const startDateLimit = formatCivilDateISO(startDate);
    const endDateLimit = formatCivilDateISO(endDate);

    const buckets: TimeBucket[] = [];
    for (let w = quantity - 1; w >= 0; w--) {
      const bEnd = new Date(now);
      bEnd.setDate(bEnd.getDate() - (offset * 7 + w * 7));
      const bStart = new Date(bEnd);
      bStart.setDate(bStart.getDate() - 6);

      const weekKey = `w-${w}-${offset}`;
      const weekLabel = `${bStart.getDate()} ${MONTH_NAMES_ES_SHORT[bStart.getMonth()]} - ${bEnd.getDate()} ${MONTH_NAMES_ES_SHORT[bEnd.getMonth()]}`;
      buckets.push({
        key: weekKey,
        label: weekLabel,
        startDate: formatCivilDateISO(bStart),
        endDate: formatCivilDateISO(bEnd),
      });
    }

    const summaryLabel = `${quantity} ${quantity === 1 ? "semana" : "semanas"}: ${startDate.getDate()} ${MONTH_NAMES_ES_SHORT[startDate.getMonth()]} al ${endDate.getDate()} ${MONTH_NAMES_ES_SHORT[endDate.getMonth()]}`;
    const periodDescription = isCurrentPeriod ? `Últimas ${quantity} semanas` : `Ventana de ${quantity} semanas`;

    return {
      granularity: "weeks",
      quantity,
      offset,
      startDateLimit,
      endDateLimit,
      summaryLabel,
      periodDescription,
      isCurrentPeriod,
      buckets,
    };
  }

  if (granularity === "days") {
    const endDaysAgo = offset * quantity;
    const startDaysAgo = endDaysAgo + quantity - 1;

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - endDaysAgo);

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - startDaysAgo);

    const startDateLimit = formatCivilDateISO(startDate);
    const endDateLimit = formatCivilDateISO(endDate);

    const buckets: TimeBucket[] = [];
    for (let dIndex = quantity - 1; dIndex >= 0; dIndex--) {
      const d = new Date(now);
      d.setDate(d.getDate() - (endDaysAgo + dIndex));
      const iso = formatCivilDateISO(d);
      const dayLabel = `${d.getDate()} ${MONTH_NAMES_ES_SHORT[d.getMonth()]}`;
      buckets.push({
        key: iso,
        label: dayLabel,
        startDate: iso,
        endDate: iso,
      });
    }

    const summaryLabel = `${quantity} días: ${startDate.getDate()} ${MONTH_NAMES_ES_SHORT[startDate.getMonth()]} al ${endDate.getDate()} ${MONTH_NAMES_ES_SHORT[endDate.getMonth()]}`;
    const periodDescription = isCurrentPeriod ? `Últimos ${quantity} días` : `Ventana de ${quantity} días`;

    return {
      granularity: "days",
      quantity,
      offset,
      startDateLimit,
      endDateLimit,
      summaryLabel,
      periodDescription,
      isCurrentPeriod,
      buckets,
    };
  }

  // granularity === "years"
  const endYear = now.getFullYear() - offset;
  const startYear = endYear - (quantity - 1);

  const startDateLimit = `${startYear}-01-01`;
  const endDateLimit = `${endYear}-12-31`;

  const buckets: TimeBucket[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const yStr = String(y);
    buckets.push({
      key: yStr,
      label: yStr,
      startDate: `${yStr}-01-01`,
      endDate: `${yStr}-12-31`,
    });
  }

  const summaryLabel = quantity === 1
    ? `Año ${endYear}`
    : `Años ${startYear} - ${endYear} (${quantity} años)`;
  const periodDescription = isCurrentPeriod ? `Últimos ${quantity} años` : `Histórico anual`;

  return {
    granularity: "years",
    quantity,
    offset,
    startDateLimit,
    endDateLimit,
    summaryLabel,
    periodDescription,
    isCurrentPeriod,
    buckets,
  };
}
