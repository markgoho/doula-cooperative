import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION } from "../constants";
import { verifyAdmin } from "./verify-admin";

export interface ExtendMembershipRequest {
  uid: string;
  newExpirationDate: string; // ISO date string
}

export interface ExtendMembershipResponse {
  success: boolean;
}

/**
 * Admin-only function to extend a membership expiration date.
 */
export async function handleExtendMembership(
  data: ExtendMembershipRequest,
  context: CallableRequest,
): Promise<ExtendMembershipResponse> {
  verifyAdmin(context);

  const { uid, newExpirationDate } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  if (!newExpirationDate) {
    throw new HttpsError("invalid-argument", "New expiration date is required.");
  }

  try {
    const firestore = getFirestore();
    const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(uid);

    // Verify member exists
    const memberDocument = await memberReference.get();
    if (!memberDocument.exists) {
      throw new HttpsError("not-found", `Member with UID ${uid} not found.`);
    }

    const expiresAt = Timestamp.fromDate(new Date(newExpirationDate));

    // Update the member document
    await memberReference.update({
      membershipExpiresAt: expiresAt,
    });

    logger.log(
      `Admin ${context.auth?.uid} extended membership for ${uid} to ${expiresAt.toDate().toISOString()}`,
    );

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error extending membership:", error);
    throw new HttpsError("internal", "Failed to extend membership.");
  }
}
