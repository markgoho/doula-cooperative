import type { DecodedIdToken } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { ForbiddenError } from "../../../shared-api/errors/http-error.js";
import { verifyAuthToken } from "./verify-token.js";

/**
 * Verify that the authenticated user is either an admin or accessing their own data.
 *
 * @param authorizationHeader - The Authorization header value
 * @param resourceUid - The UID of the resource being accessed
 * @returns Decoded token if access is allowed
 * @throws AuthError if not authenticated
 * @throws ForbiddenError if not authorized
 */
export async function verifyOwnerOrAdmin(
  authorizationHeader: string | undefined,
  resourceUid: string,
): Promise<DecodedIdToken> {
  const decodedToken = await verifyAuthToken(authorizationHeader);

  const isAdmin = decodedToken["admin"] === true;
  const isOwner = decodedToken.uid === resourceUid;

  if (!isAdmin && !isOwner) {
    logger.warn("User attempted to access unauthorized resource", {
      uid: decodedToken.uid,
      resourceUid,
    });
    throw new ForbiddenError("You can only access your own data");
  }

  return decodedToken;
}
