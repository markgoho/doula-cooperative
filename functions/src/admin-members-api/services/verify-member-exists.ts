import { NotFoundError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { MemberFirestoreService } from "@doula-coop/functions-shared/shared-api/services/member-firestore/index.js";
import type { MemberDocument } from "@doula-coop/functions-shared/types/member-document.js";

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
  const memberDocument = await MemberFirestoreService.getMemberByUid(memberId);

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
