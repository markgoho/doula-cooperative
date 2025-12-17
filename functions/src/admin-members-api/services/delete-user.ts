import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import { verifyMemberExists } from "./verify-member-exists.js";

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
 * Delete a user's member document and Auth account.
 *
 * Deletes both the Firestore member document and Firebase Auth user in a single
 * operation. The Firestore document is deleted first to ensure data consistency.
 *
 * @param memberId - The Firestore document ID (must match Auth UID)
 * @param requestingAdminUid - The UID of the admin making the request
 * @returns Promise resolving when deletion is complete
 * @throws NotFoundError if member document or Auth user does not exist
 * @throws ForbiddenError if trying to delete self or another admin
 * @throws ValidationError if user ID format is invalid
 * @throws Error if Firebase Auth deletion fails (network, permissions, etc.)
 */
export async function deleteUser(
  memberId: string,
  requestingAdminUid: string,
): Promise<void> {
  // Verify member document exists
  await verifyMemberExists(memberId);

  // Prevent admin from deleting themselves
  if (requestingAdminUid === memberId) {
    throw new ForbiddenError("You cannot delete your own account");
  }

  const auth = getAuth();

  let targetUser;
  try {
    targetUser = await auth.getUser(memberId);
  } catch (error) {
    if (isAuthError(error)) {
      if (error.code === "auth/user-not-found") {
        throw new NotFoundError(`User with ID ${memberId} not found in Auth`);
      }

      if (error.code === "auth/invalid-uid") {
        throw new ValidationError(`Invalid user ID format: ${memberId}`);
      }
    }

    throw error;
  }

  if (targetUser.customClaims?.["admin"] === true) {
    throw new ForbiddenError(
      "Cannot delete admin users. Remove admin privileges first.",
    );
  }

  // Delete member document first to ensure data consistency
  const firestore = getFirestore();
  await firestore.collection(MEMBERS_COLLECTION).doc(memberId).delete();

  // Then delete Auth user
  try {
    await auth.deleteUser(memberId);
  } catch (error) {
    if (isAuthError(error) && error.code === "auth/user-not-found") {
      // Log warning - Auth user missing indicates data inconsistency
      // (member doc existed but Auth user didn't)
      logger.warn(
        `Auth user not found during deletion (possible data inconsistency)`,
        { memberId, requestingAdminUid },
      );
      return;
    }

    throw error;
  }
}
