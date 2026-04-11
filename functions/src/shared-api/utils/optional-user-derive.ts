import type { DecodedIdToken } from "firebase-admin/auth";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../errors/http-error.js";
import type { AuthService } from "../services/auth/interface.js";
import type { Logger } from "../types/logger.js";

/**
 * Auth result from optional derive - either a token, no token, or an error.
 * Index signature required for Elysia's derive return type.
 */
export interface OptionalUserAuthResult {
  [key: string]: unknown;
  userToken: DecodedIdToken | undefined;
  authError: HttpError | undefined;
}

/**
 * Optional user authentication derive function for Elysia plugins.
 * Unlike `userDerive`, this does NOT treat a missing Authorization header as an error.
 *
 * Behavior:
 * - No Authorization header → { userToken: undefined, authError: undefined }
 * - Valid token → { userToken: token, authError: undefined }
 * - Invalid token → { userToken: undefined, authError: error }
 * - Unexpected error → re-thrown
 *
 * Use for routes that work differently for authenticated vs unauthenticated users.
 *
 * @example
 * ```typescript
 * .derive(optionalUserDerive)
 * .get("/:slug", ({ userToken }) => {
 *   // userToken may be undefined if no auth header was sent
 * })
 * ```
 */
export async function optionalUserDerive({
  request,
  authService,
  logger,
}: {
  request: Request;
  authService: AuthService;
  logger: Logger;
}): Promise<OptionalUserAuthResult> {
  const authorizationHeader = request.headers.get("authorization") ?? undefined;

  // No auth header — anonymous access (not an error)
  if (!authorizationHeader) {
    return { userToken: undefined, authError: undefined };
  }

  try {
    const token = await authService.verifyAuthToken(authorizationHeader);
    return { userToken: token, authError: undefined };
  } catch (error) {
    // Known HTTP errors from auth service (401)
    if (error instanceof HttpError) {
      return { userToken: undefined, authError: error };
    }

    // Unexpected errors (programming bugs, network failures, etc.)
    // Log with CRITICAL severity and re-throw to avoid masking as auth failure
    logger.error("CRITICAL: Unexpected error in optional user authentication", {
      errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      hasAuthHeader: Boolean(authorizationHeader),
    });

    // Re-throw to let Elysia's error handler return proper 500 response
    throw error;
  }
}
