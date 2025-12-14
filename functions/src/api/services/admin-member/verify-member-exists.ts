import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { NotFoundError } from "../../errors/http-error.js";

/**
 * Verify that a member exists in Firestore.
 *
 * @param memberId - The Firestore document ID
 * @returns Promise resolving to the member document
 * @throws NotFoundError if the member does not exist
 */
export async function verifyMemberExists(
  memberId: string,
): Promise<MemberDocument> {
  const firestore = getFirestore();
  const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(memberId);

  const memberDocument = await memberReference.get();

  if (!memberDocument.exists) {
    throw new NotFoundError(`Member with ID ${memberId} not found`);
  }

  const data = memberDocument.data() as MemberDocument;

  // Ensure uid matches document ID (uid is the document ID in members collection)
  return {
    ...data,
    uid: memberDocument.id,
  };
}
