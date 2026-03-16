import type { DecodedIdToken } from "firebase-admin/auth";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { AuthError } from "../errors/http-error.js";
import type { Logger } from "../types/logger.js";

/**
 * Extract admin UID from decoded token.
 * Assumes the onBeforeHandle guard has already validated the token exists.
 *
 * @param adminToken - Decoded admin ID token from auth guard
 * @param logger - Logger for error reporting
 * @returns Admin user's UID
 * @throws AuthError if adminToken is undefined (indicates guard bug)
 */
export function getAdminUid(
  adminToken: DecodedIdToken | undefined,
  logger: Logger,
): string {
  if (!adminToken) {
    logger.error("Admin token missing in route handler", {
      errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
      message: "This indicates a bug in the authentication guard",
    });
    throw new AuthError(
      "Authentication token missing. This is a server error, please try again.",
    );
  }
  return adminToken.uid;
}
