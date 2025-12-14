import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { ValidationError } from "../../errors/http-error.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Extend a membership expiration date.
 *
 * @param memberId - The Firestore document ID
 * @param newExpirationDate - New expiration date (ISO 8601)
 * @returns Promise resolving to updated member document
 * @throws NotFoundError if member does not exist
 * @throws ValidationError if date is invalid
 */
export async function extendMembership(
  memberId: string,
  newExpirationDate: string,
): Promise<MemberDocument> {
  // Verify member exists first
  await verifyMemberExists(memberId);

  // Validate and convert date
  const date = new Date(newExpirationDate);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date format for newExpirationDate");
  }

  const expiresAt = Timestamp.fromDate(date);

  const firestore = getFirestore();
  const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(memberId);

  // Update the member document
  await memberReference.update({
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
