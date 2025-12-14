import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { ValidationError } from "../../errors/http-error.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Update a member's fields (partial update).
 * Rejects updates to protected fields (uid, createdAt).
 * Accepts API shape (dates as ISO strings), converts to Firestore shape internally.
 *
 * @param memberId - The Firestore document ID
 * @param updates - Partial member updates with dates as ISO strings
 * @returns Promise resolving to updated member document
 * @throws NotFoundError if member does not exist
 * @throws ValidationError if trying to update protected fields
 */
export async function updateMember(
  memberId: string,
  updates: {
    name?: string;
    email?: string;
    subscriptionStart?: string;
    membershipExpiresAt?: string;
    membershipActive?: boolean;
    slug?: string;
  },
): Promise<MemberDocument> {
  // Verify member exists first
  await verifyMemberExists(memberId);

  // Prevent updating protected fields
  const protectedFields = ["uid", "createdAt"];
  for (const field of protectedFields) {
    if (field in updates) {
      throw new ValidationError(`Cannot update protected field: ${field}`);
    }
  }

  // Convert date strings to Timestamps and build Firestore update
  const processedUpdates: Partial<MemberDocument> = {};

  // Copy non-date fields
  if (updates.name !== undefined) processedUpdates.name = updates.name;
  if (updates.email !== undefined) processedUpdates.email = updates.email;
  if (updates.membershipActive !== undefined)
    processedUpdates.membershipActive = updates.membershipActive;
  if (updates.slug !== undefined) processedUpdates.slug = updates.slug;

  // Convert date strings to Timestamps
  if (updates.subscriptionStart !== undefined) {
    processedUpdates.subscriptionStart = Timestamp.fromDate(
      new Date(updates.subscriptionStart),
    );
  }
  if (updates.membershipExpiresAt !== undefined) {
    processedUpdates.membershipExpiresAt = Timestamp.fromDate(
      new Date(updates.membershipExpiresAt),
    );
  }

  const firestore = getFirestore();
  const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(memberId);

  // Update the document
  await memberReference.update(processedUpdates);

  // Fetch and return the updated document
  const updatedDocument = await memberReference.get();
  const data = updatedDocument.data() as MemberDocument;

  return {
    ...data,
    uid: updatedDocument.id,
  };
}
