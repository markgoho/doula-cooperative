import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
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
}): Promise<(MemberDocument & { uid: string }) | undefined> {
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
}
