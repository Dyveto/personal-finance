/**
 * transactions-search.ts
 *
 * Utilidades para el filtrado multi-palabra de transacciones con lógica OR inclusiva.
 * Permite buscar por múltiples palabras clave simultáneamente sobre descripción,
 * notas, nombre de categoría y nombre de cuenta.
 */

export interface SearchableTransaction {
  description: string;
  notes?: string | null;
}

/**
 * Evalúa si una transacción coincide con al menos una de las palabras clave (lógica OR).
 * Si la lista de palabras clave está vacía, retorna true (no restringe la búsqueda).
 * La comparación es insensible a mayúsculas y minúsculas (case-insensitive).
 */
export function matchesSearchKeywords(
  tx: SearchableTransaction,
  categoryName: string,
  accountName: string,
  keywords: string[]
): boolean {
  const cleanedKeywords = keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);

  // Si no hay palabras clave activas, coinciden todas las transacciones
  if (cleanedKeywords.length === 0) {
    return true;
  }

  const desc = (tx?.description ?? "").toLowerCase();
  const notes = tx?.notes ? tx.notes.toLowerCase() : "";
  const cat = (categoryName ?? "").toLowerCase();
  const acc = (accountName ?? "").toLowerCase();

  // Lógica OR: Al menos una palabra clave debe coincidir en alguno de los campos
  return cleanedKeywords.some(
    (kw) =>
      desc.includes(kw) ||
      notes.includes(kw) ||
      cat.includes(kw) ||
      acc.includes(kw)
  );
}

/**
 * Agrega una nueva palabra clave al listado de tags sin duplicados (case-insensitive).
 */
export function addSearchTag(tags: string[], newTag: string): string[] {
  const trimmed = newTag.trim();
  if (!trimmed) return tags;

  const lower = trimmed.toLowerCase();
  if (tags.some((t) => t.toLowerCase() === lower)) {
    return tags;
  }

  return [...tags, trimmed];
}

/**
 * Remueve una palabra clave del listado de tags (case-insensitive).
 */
export function removeSearchTag(tags: string[], tagToRemove: string): string[] {
  const lower = tagToRemove.trim().toLowerCase();
  return tags.filter((t) => t.trim().toLowerCase() !== lower);
}
