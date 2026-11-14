/**
 * Resultado estructurado estándar para Server Actions y operaciones de backend.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      validationErrors?: Record<string, string[]>;
    };
