import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Activate a membership with optional start and expiration dates.
 * Defaults: subscriptionStart = now, membershipExpiresAt = +1 year
 *
 * @param memberId - The Firestore document ID
 * @param options - Optional subscription start and expiration dates (ISO 8601)
 * @returns Promise resolving to updated member document
 * @throws NotFoundError if member does not exist
 */
export async function activateMembership(
  memberId: string,
  options?: {
    subscriptionStart?: string;
    membershipExpiresAt?: string;
  },
): Promise<MemberDocument> {
  // Verify member exists first
  await verifyMemberExists(memberId);

  // Use provided dates or defaults
  const startDate = options?.subscriptionStart
    ? Timestamp.fromDate(new Date(options.subscriptionStart))
    : Timestamp.now();

  const expiresAt = options?.membershipExpiresAt
    ? Timestamp.fromDate(new Date(options.membershipExpiresAt))
    : Timestamp.fromDate(
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // One year from now
      );

  const firestore = getFirestore();
  const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(memberId);

  // Update the member document
  await memberReference.update({
    membershipActive: true,
    subscriptionStart: startDate,
    membershipExpiresAt: expiresAt,
  });

  // Fetch and return the updated document
  const updatedDocument = await memberReference.get();
  const data = updatedDocument.data() as MemberDocument;

  return {
    ...data,
    uid: updatedDocument.id,
  };
}
