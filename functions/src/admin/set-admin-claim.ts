import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

/**
 * Callable function to set admin custom claim on a user.
 * This function can only be called by users who already have admin claims,
 * or must be executed manually via Firebase Admin SDK.
 */
export async function handleSetAdminClaim(
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
  if (!context.auth.token["admin"]) {
    throw new HttpsError(
      "permission-denied",
      "Only admins can grant admin privileges.",
    );
  }

  const { uid } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  try {
    const auth = getAuth();

    // Verify the target user exists
    await auth.getUser(uid);

    // Set the custom claim
    await auth.setCustomUserClaims(uid, { admin: true });

    logger.log(`Admin claim granted to user: ${uid} by ${context.auth.uid}`);

    return { success: true };
  } catch (error) {
    logger.error("Error setting admin claim:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while setting admin claim.",
    );
  }
}
