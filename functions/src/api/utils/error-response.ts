import type { ErrorId } from "../../constants/error-ids.js";

/**
 * Generate an actionable error message with a unique reference for support.
 *
 * @param operation - Description of the operation that failed (e.g., "activate membership")
 * @param errorId - Error ID from ERROR_IDS constants
 * @returns User-friendly error message with reference
 */
export function createErrorResponse(
  operation: string,
  errorId: ErrorId,
): string {
  const errorReference = `${errorId}-${Date.now()}`;
  return `Failed to ${operation}. Please try again. If the problem persists, contact support with reference: ${errorReference}`;
}
