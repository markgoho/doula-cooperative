import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { AuthError, ForbiddenError } from "../errors/http-error.js";
import type { AuthService as AuthServiceInterface } from "./service-interfaces.js";

/**
 * Categorize Firebase Auth error messages for appropriate user feedback.
 * @param errorMessage - Lowercase error message from Firebase
 * @returns Error category type
 */
function categorizeAuthError(errorMessage: string): "expired" | "revoked" | "malformed" | "project_mismatch" | "unknown" {
  if (errorMessage.includes("token expired") || errorMessage.includes("exp")) {
    return "expired";
  }
  if (errorMessage.includes("token revoked") || errorMessage.includes("revoked")) {
    return "revoked";
  }
  if (errorMessage.includes("invalid token") || errorMessage.includes("malformed") || errorMessage.includes("decode")) {
    return "malformed";
  }
  if (errorMessage.includes("project") || errorMessage.includes("audience")) {
    return "project_mismatch";
  }
  return "unknown";
}

/**
 * Service for authentication and authorization operations.
 * Decoupled from HTTP framework - does not depend on Elysia Context.
 */
export const AuthService: AuthServiceInterface = {
  /**
   * Extract and verify Firebase Auth token from Authorization header.
   *
   * @param authHeader - The Authorization header value (e.g., "Bearer token123")
   * @returns Decoded Firebase token with uid and custom claims
   * @throws AuthError if token is missing, invalid, or expired
   */
  async verifyAuthToken(authHeader: string | undefined): Promise<DecodedIdToken> {
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
      // Categorize errors by type for better user feedback
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorType = categorizeAuthError(errorMessage);

        switch (errorType) {
          case "expired": {
            logger.warn("Expired auth token", { errorMessage: error.message });
            throw new AuthError("Your session has expired. Please sign in again.");
          }

          case "revoked": {
            logger.warn("Revoked auth token", { errorMessage: error.message });
            throw new AuthError("Your session has been revoked. Please sign in again.");
          }

          case "malformed": {
            logger.warn("Malformed auth token", { errorMessage: error.message });
            throw new AuthError("Invalid authentication token format");
          }

          case "project_mismatch": {
            logger.error("Auth token from wrong project", {
              errorMessage: error.message,
            });
            throw new AuthError("Authentication token is not valid for this application");
          }

          default: {
            logger.error("Firebase Auth verification failed with unexpected error", {
              error,
              errorMessage: error.message,
              errorStack: error.stack,
            });
            throw new AuthError("Unable to verify authentication token. Please try again.");
          }
        }
      }

      logger.error("Firebase Auth verification failed with non-Error object", {
        error,
      });
      throw new AuthError("Unable to verify authentication token. Please try again.");
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
  async verifyAdmin(authHeader: string | undefined): Promise<DecodedIdToken> {
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
  async verifyOwnerOrAdmin(authHeader: string | undefined, resourceUid: string): Promise<DecodedIdToken> {
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
