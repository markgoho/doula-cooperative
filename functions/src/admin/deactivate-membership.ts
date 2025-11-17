import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION } from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface DeactivateMembershipRequest {
  uid: string;
}

export interface DeactivateMembershipResponse {
  success: boolean;
}

/**
 * Admin-only function to manually deactivate a membership.
 */
export async function handleDeactivateMembership(
  data: DeactivateMembershipRequest,
  context: CallableRequest,
): Promise<DeactivateMembershipResponse> {
  verifyAdmin(context);

  const { uid } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  try {
    const firestore = getFirestore();
    const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(uid);

    // Verify member exists
    const memberDocument = await memberReference.get();
    if (!memberDocument.exists) {
      throw new HttpsError("not-found", `Member with UID ${uid} not found.`);
    }

    // Update the member document
    await memberReference.update({
      membershipActive: false,
    });

    logger.log(`Admin ${context.auth?.uid} deactivated membership for ${uid}`);

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error deactivating membership:", error);
    throw new HttpsError("internal", "Failed to deactivate membership.");
  }
}
