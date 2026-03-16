import { updateMemberWithValidation } from "@doula-coop/functions-shared/shared-api/utils/firestore-helpers.js";
import type { MemberDocument } from "@doula-coop/functions-shared/types/member-document.js";
import { logger } from "firebase-functions/v2";
import { cancelStripeSubscriptionAtPeriodEnd } from "../../stripe-webhook-api/services/cancel-stripe-subscription-at-period-end.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Cancel a membership.
 *
 * For Stripe members: schedules subscription cancellation at end of billing period
 * and sets subscriptionStatus to "canceled". Member remains active until period ends.
 *
 * For legacy/manual members without Stripe data: sets membershipActive to false immediately.
 *
 * @param memberId - The Firestore document ID
 * @returns Promise resolving to updated member document
 * @throws NotFoundError if member does not exist
 * @throws Error if Stripe cancellation fails
 */
export async function cancelMembership(
  memberId: string,
): Promise<MemberDocument> {
  const member = await verifyMemberExists(memberId);

  const { stripeCustomerId, stripeSubscriptionId } = member;

  if (stripeCustomerId !== undefined && stripeSubscriptionId !== undefined) {
    // Stripe member: cancel at period end, keep active until period expires
    await cancelStripeSubscriptionAtPeriodEnd({
      subscriptionId: stripeSubscriptionId,
    });

    logger.info(
      "Stripe subscription scheduled for cancellation at period end",
      {
        memberId,
        subscriptionId: stripeSubscriptionId,
      },
    );

    return updateMemberWithValidation({
      memberId,
      updates: {
        subscriptionStatus: "canceled",
      },
      operation: "cancel membership (Stripe)",
    });
  }

  // Legacy/manual member: deactivate immediately
  logger.info("Legacy member deactivated (no Stripe data)", { memberId });

  return updateMemberWithValidation({
    memberId,
    updates: {
      membershipActive: false,
    },
    operation: "cancel membership (legacy)",
  });
}
