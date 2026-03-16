import type { DecodedIdToken } from "firebase-admin/auth";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { AuthError } from "../errors/http-error.js";
import type { Logger } from "../types/logger.js";

/**
 * Extract user UID from decoded token.
 * Assumes the onBeforeHandle guard has already validated the token exists.
 *
 * @param userToken - Decoded user ID token from auth guard
 * @param logger - Logger for error reporting
 * @returns User's UID
 * @throws AuthError if userToken is undefined (indicates guard bug)
 */
export function getUserUid(
  userToken: DecodedIdToken | undefined,
  logger: Logger,
): string {
  if (!userToken) {
    logger.error("User token missing in route handler", {
      errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
      message: "This indicates a bug in the authentication guard",
    });
    throw new AuthError(
      "Authentication token missing. This is a server error, please try again.",
    );
  }
  return userToken.uid;
}
