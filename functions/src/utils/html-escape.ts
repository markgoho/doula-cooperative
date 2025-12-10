/**
 * Escapes HTML special characters to prevent XSS in email templates
 * @param unsafe - String that may contain HTML special characters
 * @returns HTML-safe string with special characters escaped
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe === null || unsafe === undefined) {
    return "";
  }

  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
