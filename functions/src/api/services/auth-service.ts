import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { AuthError, ForbiddenError } from "../errors/http-error.js";

/**
 * Service for authentication and authorization operations.
 * Decoupled from HTTP framework - does not depend on Elysia Context.
 */
export const AuthService = {
  /**
   * Extract and verify Firebase Auth token from Authorization header.
   *
   * @param authHeader - The Authorization header value (e.g., "Bearer token123")
   * @returns Decoded Firebase token with uid and custom claims
   * @throws AuthError if token is missing, invalid, or expired
   */
  async verifyAuthToken(authHeader: string | undefined) {
    if (!authHeader) {
      throw new AuthError("Missing Authorization header");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new AuthError("Authorization header must use Bearer scheme");
    }

    const token = authHeader.slice(7).trim(); // Remove "Bearer " prefix and trim

    if (token.length === 0) {
      throw new AuthError("Missing auth token");
    }

    try {
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      logger.warn("Failed to verify auth token", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AuthError("Invalid or expired auth token");
    }
  },

  /**
   * Verify that the authenticated user has admin privileges.
   *
   * @param authHeader - The Authorization header value
   * @returns Decoded token if user is admin
   * @throws AuthError if not authenticated
   * @throws ForbiddenError if not an admin
   */
  async verifyAdmin(authHeader: string | undefined) {
    const decodedToken = await AuthService.verifyAuthToken(authHeader);

    const isAdmin = decodedToken["admin"] === true;

    if (!isAdmin) {
      logger.warn("Non-admin user attempted to access admin endpoint", {
        uid: decodedToken.uid,
      });
      throw new ForbiddenError("This endpoint requires admin privileges");
    }

    return decodedToken;
  },

  /**
   * Verify that the authenticated user is either an admin or accessing their own data.
   *
   * @param authHeader - The Authorization header value
   * @param resourceUid - The UID of the resource being accessed
   * @returns Decoded token if access is allowed
   * @throws AuthError if not authenticated
   * @throws ForbiddenError if not authorized
   */
  async verifyOwnerOrAdmin(authHeader: string | undefined, resourceUid: string) {
    const decodedToken = await AuthService.verifyAuthToken(authHeader);

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
  },
};
