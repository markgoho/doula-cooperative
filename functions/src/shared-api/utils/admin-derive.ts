import type { DecodedIdToken } from "firebase-admin/auth";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../errors/http-error.js";
import type { AuthService } from "../services/auth/interface.js";
import type { Logger } from "../types/logger.js";

/**
 * Auth result from derive - either a token or an error.
 * Index signature required for Elysia's derive return type.
 */
export interface AuthResult {
  [key: string]: unknown;
  adminToken: DecodedIdToken | undefined;
  authError: HttpError | undefined;
}

/**
 * Shared admin authentication derive function for Elysia plugins.
 * Verifies admin privileges and adds adminToken/authError to context.
 *
 * Use with adminGuard in onBeforeHandle to protect routes:
 *
 * @example
 * ```typescript
 * .derive(adminDerive)
 * .onBeforeHandle({ as: "local" }, adminGuard)
 * ```
 */
export async function adminDerive({
  request,
  authService,
  logger,
}: {
  request: Request;
  authService: AuthService;
  logger: Logger;
}): Promise<AuthResult> {
  const authorizationHeader =
    request.headers.get("authorization") ?? undefined;
  try {
    const token = await authService.verifyAdmin(authorizationHeader);
    return { adminToken: token, authError: undefined };
  } catch (error) {
    // Known HTTP errors from auth service (401, 403)
    if (error instanceof HttpError) {
      return { adminToken: undefined, authError: error };
    }

    // Unexpected errors (programming bugs, network failures, etc.)
    // Log with CRITICAL severity and re-throw to avoid masking as auth failure
    logger.error("CRITICAL: Unexpected error in admin authentication", {
      errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      hasAuthHeader: Boolean(authorizationHeader),
    });

    // Re-throw to let Elysia's error handler return proper 500 response
    // This prevents programming bugs from being masked as "auth unavailable"
    throw error;
  }
}
