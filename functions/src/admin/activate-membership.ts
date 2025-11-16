import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION } from "../constants/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface ActivateMembershipRequest {
  uid: string;
  subscriptionStart?: string; // ISO date string
  membershipExpiresAt?: string; // ISO date string
}

export interface ActivateMembershipResponse {
  success: boolean;
}

/**
 * Admin-only function to manually activate a membership.
 * If dates are not provided, uses current date for start and one year from now for expiration.
 */
export async function handleActivateMembership(
  data: ActivateMembershipRequest,
  context: CallableRequest,
): Promise<ActivateMembershipResponse> {
  verifyAdmin(context);

  const { uid, subscriptionStart, membershipExpiresAt } = data;

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

    // Use provided dates or defaults
    const startDate = subscriptionStart
      ? Timestamp.fromDate(new Date(subscriptionStart))
      : Timestamp.now();

    const expiresAt = membershipExpiresAt
      ? Timestamp.fromDate(new Date(membershipExpiresAt))
      : Timestamp.fromDate(
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // One year from now
        );

    // Update the member document
    await memberReference.update({
      membershipActive: true,
      subscriptionStart: startDate,
      membershipExpiresAt: expiresAt,
    });

    logger.log(
      `Admin ${context.auth?.uid} activated membership for ${uid} until ${expiresAt.toDate().toISOString()}`,
    );

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error activating membership:", error);
    throw new HttpsError("internal", "Failed to activate membership.");
  }
}
