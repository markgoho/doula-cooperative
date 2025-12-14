import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Deactivate a membership.
 *
 * @param memberId - The Firestore document ID
 * @returns Promise resolving to updated member document
 * @throws NotFoundError if member does not exist
 */
export async function deactivateMembership(
  memberId: string,
): Promise<MemberDocument> {
  // Verify member exists first
  await verifyMemberExists(memberId);

  const firestore = getFirestore();
  const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(memberId);

  // Update the member document
  await memberReference.update({
    membershipActive: false,
  });

  // Fetch and return the updated document
  const updatedDocument = await memberReference.get();
  const data = updatedDocument.data() as MemberDocument;

  return {
    ...data,
    uid: updatedDocument.id,
  };
}
