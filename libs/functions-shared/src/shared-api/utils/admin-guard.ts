import type { DecodedIdToken } from "firebase-admin/auth";
import type { HttpError } from "../errors/http-error.js";

/**
 * Admin authentication guard for Elysia onBeforeHandle hook.
 * Checks if admin token exists and returns error response if not.
 *
 * Use with derive() that adds adminToken and authError to context.
 *
 * @example
 * ```typescript
 * .derive(async ({ request, authService }) => {
 *   // ... verify admin and return { adminToken, authError }
 * })
 * .onBeforeHandle({ as: "local" }, adminGuard)
 * ```
 */
export function adminGuard({
  adminToken,
  authError,
  set,
}: {
  adminToken: DecodedIdToken | undefined;
  authError: HttpError | undefined;
  set: { status?: number | string };
}): { error: string } | undefined {
  if (!adminToken && authError) {
    set.status = authError.statusCode;
    return { error: authError.message };
  }
  if (!adminToken) {
    set.status = 401;
    return { error: "Unauthorized" };
  }
  return undefined;
}
