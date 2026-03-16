import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { getAuth } from "firebase-admin/auth";

interface FirebaseAuthError {
  code: string;
  message: string;
}

function isAuthError(error: unknown): error is FirebaseAuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as FirebaseAuthError).code === "string"
  );
}

/**
 * Update custom claims for a user.
 * Claims are merged with existing claims. Set a claim to false to remove it.
 *
 * @param uid - The UID of the user to update claims for
 * @param claims - Claims to update (e.g., { admin: true })
 * @param requestingAdminUid - The UID of the admin making the request
 * @param logger - Logger instance for error logging
 * @returns Promise resolving when claims are updated
 * @throws NotFoundError if user does not exist
 * @throws ForbiddenError if trying to modify own admin claim
 * @throws ValidationError if UID format is invalid
 * @throws Error if Firebase Auth operation fails
 */
export async function updateClaims({
  uid,
  claims,
  requestingAdminUid,
  logger,
}: {
  uid: string;
  claims: { admin?: boolean };
  requestingAdminUid: string;
  logger: Logger;
}): Promise<void> {
  if (!uid) {
    throw new ValidationError("UID is required");
  }

  // Prevent self-modification of admin claim
  if (uid === requestingAdminUid && claims.admin !== undefined) {
    throw new ForbiddenError("Cannot modify your own admin privileges");
  }

  const auth = getAuth();

  let user;
  try {
    user = await auth.getUser(uid);
  } catch (error) {
    if (isAuthError(error)) {
      if (error.code === "auth/user-not-found") {
        throw new NotFoundError(`User with ID ${uid} not found`);
      }

      if (error.code === "auth/invalid-uid") {
        throw new ValidationError(`Invalid user ID format: ${uid}`);
      }

      // Handle other Firebase Auth errors
      logger.error("Unexpected Firebase Auth error during getUser", {
        errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
        error,
        errorMessage: error.message,
        errorCode: error.code,
        uid,
        requestingAdminUid,
      });
      throw error;
    }

    // Completely unexpected error type
    logger.error("CRITICAL: Non-Firebase error during getUser", {
      errorId: ERROR_IDS.API_ADMIN_SET_ADMIN_CLAIM_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      uid,
      requestingAdminUid,
    });
    throw error;
  }

  // Get current claims and merge with updates
  const currentClaims = user.customClaims ?? {};
  const updatedClaims = { ...currentClaims };

  // Update or remove claims based on values
  for (const [key, value] of Object.entries(claims)) {
    if (value) {
      // Set claim if truthy
      updatedClaims[key] = value;
    } else {
      // Remove claim if falsy (false or undefined)
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updatedClaims[key];
    }
  }

  try {
    await auth.setCustomUserClaims(uid, updatedClaims);
  } catch (error) {
    // Log Firebase Auth errors during claim update
    logger.error("Failed to update user custom claims in Firebase Auth", {
      errorId: ERROR_IDS.API_ADMIN_SET_ADMIN_CLAIM_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      uid,
      claims,
      requestingAdminUid,
      updatedClaims,
    });
    throw error;
  }
}
