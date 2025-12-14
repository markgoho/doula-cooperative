import type { MemberDocument } from "../../../types/member-document.js";
import { ValidationError } from "../../errors/http-error.js";
import {
  validateAndConvertDate,
  validateMembershipDates,
} from "../../utils/date-validator.js";
import { updateMemberWithValidation } from "../../utils/firestore-helpers.js";
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
  await verifyMemberExists(memberId);

  const protectedFields = ["uid", "createdAt"];
  for (const field of protectedFields) {
    if (field in updates) {
      throw new ValidationError(`Cannot update protected field: ${field}`);
    }
  }

  validateMembershipDates(
    updates.subscriptionStart,
    updates.membershipExpiresAt,
  );

  const processedUpdates: Partial<MemberDocument> = {};

  if (updates.name !== undefined) processedUpdates.name = updates.name;
  if (updates.email !== undefined) processedUpdates.email = updates.email;
  if (updates.membershipActive !== undefined)
    processedUpdates.membershipActive = updates.membershipActive;
  if (updates.slug !== undefined) processedUpdates.slug = updates.slug;

  if (updates.subscriptionStart !== undefined) {
    processedUpdates.subscriptionStart = validateAndConvertDate(
      updates.subscriptionStart,
      "subscriptionStart",
    );
  }
  if (updates.membershipExpiresAt !== undefined) {
    processedUpdates.membershipExpiresAt = validateAndConvertDate(
      updates.membershipExpiresAt,
      "membershipExpiresAt",
    );
  }

  return updateMemberWithValidation({
    memberId,
    updates: processedUpdates,
    operation: "update member",
  });
}
