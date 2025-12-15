import { getAuth } from "firebase-admin/auth";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";

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
}: {
  uid: string;
  claims: { admin?: boolean };
  requestingAdminUid: string;
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
    }

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

  await auth.setCustomUserClaims(uid, updatedClaims);
}
