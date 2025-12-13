import type { DecodedIdToken } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { ForbiddenError } from "../../errors/http-error.js";
import { verifyAuthToken } from "./verify-token.js";

/**
 * Verify that the authenticated user has admin privileges.
 *
 * @param authorizationHeader - The Authorization header value
 * @returns Decoded token if user is admin
 * @throws AuthError if not authenticated
 * @throws ForbiddenError if not an admin
 */
export async function verifyAdmin(
  authorizationHeader: string | undefined,
): Promise<DecodedIdToken> {
  const decodedToken = await verifyAuthToken(authorizationHeader);

  const isAdmin = decodedToken["admin"] === true;

  if (!isAdmin) {
    logger.warn("Non-admin user attempted to access admin endpoint", {
      uid: decodedToken.uid,
    });
    throw new ForbiddenError("This endpoint requires admin privileges");
  }

  return decodedToken;
}
