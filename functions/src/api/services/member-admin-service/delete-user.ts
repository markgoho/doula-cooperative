import { getAuth } from "firebase-admin/auth";
import { ForbiddenError, NotFoundError } from "../../errors/http-error.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Delete a user's Auth account and trigger member document cleanup.
 * The deleteMemberOnUserDeleted Cloud Function will handle Firestore cleanup.
 *
 * @param memberId - The Firestore document ID / Auth UID
 * @param requestingAdminUid - The UID of the admin making the request
 * @returns Promise resolving when deletion is complete
 * @throws NotFoundError if user does not exist
 * @throws ForbiddenError if trying to delete self or another admin
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

  // Verify user exists in Auth and get their custom claims
  let targetUser;
  try {
    targetUser = await auth.getUser(memberId);
  } catch {
    throw new NotFoundError(`User with ID ${memberId} not found in Auth`);
  }

  // Prevent deletion of admin users
  if (targetUser.customClaims?.["admin"] === true) {
    throw new ForbiddenError(
      "Cannot delete admin users. Remove admin privileges first.",
    );
  }

  // Delete the Auth user (triggers deleteMemberOnUserDeleted to clean up member document)
  await auth.deleteUser(memberId);
}
