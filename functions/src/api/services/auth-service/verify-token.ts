import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { AuthError } from "../../errors/http-error.js";

/**
 * Firebase Auth error with code property for categorization.
 */
interface FirebaseAuthError {
  code?: string;
  message: string;
}

/**
 * Check if error is a Firebase Auth error with a code property.
 */
function isFirebaseAuthError(error: unknown): error is FirebaseAuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as FirebaseAuthError).code === "string"
  );
}

/**
 * Extract and verify Firebase Auth token from Authorization header.
 *
 * @param authorizationHeader - The Authorization header value (e.g., "Bearer token123")
 * @returns Decoded Firebase token with uid and custom claims
 * @throws AuthError if token is missing, invalid, or expired
 */
export async function verifyAuthToken(
  authorizationHeader: string | undefined,
): Promise<DecodedIdToken> {
  if (!authorizationHeader) {
    throw new AuthError("Missing Authorization header");
  }

  if (!authorizationHeader.startsWith("Bearer ")) {
    throw new AuthError("Authorization header must use Bearer scheme");
  }

  const token = authorizationHeader.slice(7).trim(); // Remove "Bearer " prefix

  if (token.length === 0) {
    throw new AuthError("Missing auth token");
  }

  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    // Handle Firebase Auth errors by error code (not string matching)
    if (isFirebaseAuthError(error)) {
      switch (error.code) {
        case "auth/id-token-expired":
        case "auth/session-cookie-expired": {
          logger.warn("Expired auth token", {
            errorId: ERROR_IDS.API_AUTH_TOKEN_EXPIRED,
            errorCode: error.code,
          });
          throw new AuthError(
            "Your session has expired. Please sign in again.",
          );
        }

        case "auth/id-token-revoked":
        case "auth/session-cookie-revoked": {
          logger.warn("Revoked auth token", {
            errorId: ERROR_IDS.API_AUTH_TOKEN_REVOKED,
            errorCode: error.code,
          });
          throw new AuthError(
            "Your session has been revoked. Please sign in again.",
          );
        }

        case "auth/argument-error":
        case "auth/invalid-id-token":
        case "auth/invalid-session-cookie-duration": {
          logger.warn("Malformed auth token", {
            errorId: ERROR_IDS.API_AUTH_TOKEN_MALFORMED,
            errorCode: error.code,
          });
          throw new AuthError("Invalid authentication token format");
        }

        case "auth/project-not-found":
        case "auth/invalid-credential": {
          logger.error("Auth token from wrong project or invalid credentials", {
            errorId: ERROR_IDS.API_AUTH_TOKEN_WRONG_PROJECT,
            errorCode: error.code,
            errorMessage: error.message,
          });
          throw new AuthError(
            "Authentication token is not valid for this application",
          );
        }

        default: {
          logger.error(
            "Firebase Auth verification failed with unexpected error code",
            {
              errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
              error,
              errorCode: error.code,
              errorMessage: error.message,
            },
          );
          throw new AuthError(
            "Unable to verify authentication token. Please try again.",
          );
        }
      }
    }

    // Non-Firebase errors
    logger.error("Firebase Auth verification failed with non-Firebase error", {
      errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
      error,
      errorType: error?.constructor?.name,
    });
    throw new AuthError(
      "Unable to verify authentication token. Please try again.",
    );
  }
}
