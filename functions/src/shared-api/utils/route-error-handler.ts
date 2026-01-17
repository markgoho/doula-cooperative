import type { ErrorId } from "../../constants/error-ids.js";
import { HttpError } from "../errors/http-error.js";
import type { Logger } from "../types/logger.js";
import { createErrorResponse } from "./error-response.js";

/**
 * Common error context for logging
 */
interface ErrorContext {
  errorId: ErrorId;
  error: unknown;
  [key: string]: unknown;
}

/**
 * Handle errors in route logic with consistent logging and response format.
 *
 * @param error - The error that occurred
 * @param operation - Description of the operation (e.g., "list members")
 * @param errorId - Error ID from ERROR_IDS constants
 * @param logger - Logger instance
 * @param set - Response status setter
 * @param context - Additional context for error logging
 * @returns Error response object
 */
export function handleRouteError({
  error,
  operation,
  errorId,
  logger,
  set,
  context = {},
}: {
  error: unknown;
  operation: string;
  errorId: ErrorId;
  logger: Logger;
  set: { status?: number | string };
  context?: Record<string, unknown>;
}): { error: string } {
  // Handle our custom HTTP errors
  if (error instanceof HttpError) {
    set.status = error.statusCode;
    return { error: error.message };
  }

  // Log unexpected errors with full context
  const errorContext: ErrorContext = {
    errorId,
    error,
    errorMessage: error instanceof Error ? error.message : "Unknown error",
    errorStack: error instanceof Error ? error.stack : undefined,
    errorType: error?.constructor?.name,
    ...context,
  };

  logger.error(`Failed to ${operation}`, errorContext);

  set.status = 500;
  return {
    error: createErrorResponse(operation, errorId),
  };
}
