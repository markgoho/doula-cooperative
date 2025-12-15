import { validateAndConvertDate } from "../../shared-api/utils/date-validator.js";
import { updateMemberWithValidation } from "../../shared-api/utils/firestore-helpers.js";
import type { MemberDocument } from "../../types/member-document.js";
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
  await verifyMemberExists(memberId);

  const expiresAt = validateAndConvertDate(
    newExpirationDate,
    "newExpirationDate",
  );

  return updateMemberWithValidation({
    memberId,
    updates: {
      membershipExpiresAt: expiresAt,
    },
    operation: "extend membership",
  });
}
