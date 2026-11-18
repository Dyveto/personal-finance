/**
 * Clave única para persistir en almacenamiento local el estado de colapso
 * de la sección de "Totales por Categoría" en transacciones.
 */
export const CATEGORY_TOTALS_COLLAPSED_KEY = "finances_category_totals_collapsed";

/**
 * Guarda en localStorage si la sección de "Totales por Categoría" debe permanecer colapsada.
 *
 * @param collapsed true si está colapsada (oculta), false si está expandida (visible).
 * @param storage Implementación de Storage opcional (inyección para pruebas unitarias).
 */
export function setCategoryTotalsCollapsedPreference(
  collapsed: boolean,
  storage?: Storage
): void {
  try {
    const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!s) return;
    s.setItem(CATEGORY_TOTALS_COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {
    // Modo incógnito, SSR o permisos bloqueados de Storage
  }
}

/**
 * Obtiene la preferencia de si la sección de "Totales por Categoría" está colapsada.
 * Si no existe valor previo registrado, devuelve false por defecto (sección abierta/visible).
 *
 * @param storage Implementación de Storage opcional (inyección para pruebas unitarias).
 * @returns true si está colapsada, false si está abierta (valor por defecto).
 */
export function getCategoryTotalsCollapsedPreference(storage?: Storage): boolean {
  try {
    const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!s) return false;
    const value = s.getItem(CATEGORY_TOTALS_COLLAPSED_KEY);
    return value === "true";
  } catch {
    return false;
  }
}
