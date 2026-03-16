import type { DecodedIdToken } from "firebase-admin/auth";
import type { HttpError } from "../errors/http-error.js";

/**
 * User authentication guard for Elysia onBeforeHandle hook.
 * Checks if user token exists and returns error response if not.
 *
 * Use with derive() that adds userToken and authError to context.
 *
 * @example
 * ```typescript
 * .derive(async ({ request, authService }) => {
 *   // ... verify user and return { userToken, authError }
 * })
 * .onBeforeHandle({ as: "local" }, userGuard)
 * ```
 */
export function userGuard({
  userToken,
  authError,
  set,
}: {
  userToken: DecodedIdToken | undefined;
  authError: HttpError | undefined;
  set: { status?: number | string };
}): { error: string } | undefined {
  if (!userToken && authError) {
    set.status = authError.statusCode;
    return { error: authError.message };
  }
  if (!userToken) {
    set.status = 401;
    return { error: "Unauthorized" };
  }
  return undefined;
}
