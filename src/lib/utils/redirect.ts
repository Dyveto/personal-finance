/**
 * Utilidades de sanitización y validación de redirecciones para prevención de Open Redirect.
 */

/**
 * Sanitiza el parámetro 'next' para evitar vulnerabilidades de Open Redirect (OWASP Top 10).
 * Solo acepta rutas relativas seguras que inicien con '/' y no comiencen con '//' ni '/\',
 * ni contengan esquemas absolutos como '://'.
 *
 * @param nextParam - Parámetro de ruta recibido en la solicitud.
 * @returns Ruta relativa interna segura; en caso de invalidez o riesgo, retorna '/'.
 */
export function getSafeRedirectPath(nextParam: string | null): string {
  if (!nextParam) return "/";
  const trimmed = nextParam.trim();

  // Debe iniciar estrictamente con '/' pero NO con '//' o '/\' (protocol-relative URLs) y no contener '://'
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("://")
  ) {
    return trimmed;
  }

  return "/";
}
