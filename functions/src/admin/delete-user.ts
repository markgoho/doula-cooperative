import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION } from "../constants/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface DeleteUserRequest {
  uid: string;
}

export interface DeleteUserResponse {
  success: boolean;
}

/**
 * Admin-only function to delete a user account and their associated data.
 * This will:
 * 1. Delete the user's Firebase Auth account
 * 2. Delete the user's member document (via the deleteMemberOnUserDeleted trigger)
 *
 * WARNING: This action is irreversible.
 */
export async function handleDeleteUser(
  data: DeleteUserRequest,
  context: CallableRequest,
): Promise<DeleteUserResponse> {
  verifyAdmin(context);

  const { uid } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  // Prevent admin from deleting themselves
  if (context.auth?.uid === uid) {
    throw new HttpsError(
      "permission-denied",
      "You cannot delete your own account.",
    );
  }

  try {
    const auth = getAuth();
    const firestore = getFirestore();

    // Verify user exists in Auth and get their custom claims
    let targetUser;
    try {
      targetUser = await auth.getUser(uid);
    } catch {
      throw new HttpsError("not-found", `User with UID ${uid} not found.`);
    }

    // Prevent deletion of admin users
    if (targetUser.customClaims?.admin === true) {
      throw new HttpsError(
        "permission-denied",
        "Cannot delete admin users. Remove admin privileges first.",
      );
    }

    // Verify member document exists
    const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(uid);
    const memberDocument = await memberReference.get();

    if (!memberDocument.exists) {
      throw new HttpsError("not-found", `Member with UID ${uid} not found.`);
    }

    // Delete the Auth user (this will trigger deleteMemberOnUserDeleted to clean up the member document)
    await auth.deleteUser(uid);

    logger.log(`Admin ${context.auth?.uid} deleted user ${uid}`);

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error deleting user:", error);
    throw new HttpsError("internal", "Failed to delete user.");
  }
}
