import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { MemberDocument } from "../../types/member-document.js";

/**
 * Find a member by their Stripe customer ID.
 *
 * @param stripeCustomerId - The Stripe customer ID to search for
 * @returns The member document if found, undefined otherwise
 */
export async function findMemberByStripeCustomer({
  stripeCustomerId,
}: {
  stripeCustomerId: string;
}): Promise<MemberDocument | undefined> {
  try {
    const firestore = getFirestore();
    const querySnapshot = await firestore
      .collection(MEMBERS_COLLECTION)
      .where("stripeCustomerId", "==", stripeCustomerId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return undefined;
    }

    const document = querySnapshot.docs[0];

    if (!document) {
      return undefined;
    }

    return {
      ...(document.data() as MemberDocument),
      uid: document.id,
    };
  } catch (error) {
    logger.error("Failed to query member by Stripe customer ID", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_MEMBER_LOOKUP_FAILED,
      stripeCustomerId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
