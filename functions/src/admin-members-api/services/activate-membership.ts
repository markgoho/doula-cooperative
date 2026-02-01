import { Timestamp } from "firebase-admin/firestore";
import {
  validateAndConvertDate,
  validateMembershipDates,
} from "../../shared-api/utils/date-validator.js";
import { updateMemberWithValidation } from "../../shared-api/utils/firestore-helpers.js";
import type { MemberDocument } from "../../types/member-document.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Activate a membership with optional start and expiration dates.
 *
 * Default membership period is 1 year (365 days) from start date.
 * This aligns with the annual subscription model in Stripe checkout.
 * For leap years or subscription alignment, custom dates should be provided.
 *
 * @param memberId - The Firestore document ID
 * @param options - Optional subscription start and expiration dates
 *   Format: ISO 8601 with time and timezone (e.g., "2025-01-01T00:00:00.000Z")
 *   Timezone: Will be parsed by JavaScript Date constructor, recommend UTC (Z suffix)
 * @returns Promise resolving to updated member document
 * @throws NotFoundError if member does not exist
 * @throws ValidationError if dates are invalid or in wrong order
 */
export async function activateMembership(
  memberId: string,
  options?: {
    subscriptionStart?: string;
    membershipExpiresAt?: string;
  },
): Promise<MemberDocument> {
  await verifyMemberExists(memberId);

  validateMembershipDates(
    options?.subscriptionStart,
    options?.membershipExpiresAt,
  );

  const startDate = options?.subscriptionStart
    ? validateAndConvertDate(options.subscriptionStart, "subscriptionStart")
    : Timestamp.now();

  const expiresAt = options?.membershipExpiresAt
    ? validateAndConvertDate(options.membershipExpiresAt, "membershipExpiresAt")
    : Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

  return updateMemberWithValidation({
    memberId,
    updates: {
      membershipActive: true,
      subscriptionStart: startDate,
      membershipExpiresAt: expiresAt,
    },
    operation: "activate membership",
  });
}
