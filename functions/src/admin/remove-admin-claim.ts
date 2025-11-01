import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

/**
 * Callable function to remove admin custom claim from a user.
 * This function can only be called by users who already have admin claims.
 */
export async function handleRemoveAdminClaim(
  data: { uid: string },
  context: CallableRequest,
): Promise<{ success: boolean }> {
  // Ensure the caller is authenticated
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be authenticated to call this function.",
    );
  }

  // Ensure the caller has admin privileges
  if (!context.auth.token.admin) {
    throw new HttpsError(
      "permission-denied",
      "Only admins can revoke admin privileges.",
    );
  }

  const { uid } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  // Prevent self-revocation
  if (uid === context.auth.uid) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot revoke your own admin privileges.",
    );
  }

  try {
    const auth = getAuth();

    // Verify the target user exists
    const user = await auth.getUser(uid);

    // Get current custom claims
    const currentClaims = user.customClaims ?? {};

    // Remove admin claim by creating a new object without it
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { admin, ...remainingClaims } = currentClaims;

    // Set the updated claims
    await auth.setCustomUserClaims(uid, remainingClaims);

    logger.log(
      `Admin claim removed from user: ${uid} by ${context.auth.uid}`,
    );

    return { success: true };
  } catch (error) {
    logger.error("Error removing admin claim:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while removing admin claim.",
    );
  }
}
