import type { MemberDocument } from "../../../types/member-document.js";
import { updateMemberWithValidation } from "../../../shared-api/utils/firestore-helpers.js";
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
  await verifyMemberExists(memberId);

  return updateMemberWithValidation({
    memberId,
    updates: {
      membershipActive: false,
    },
    operation: "deactivate membership",
  });
}
