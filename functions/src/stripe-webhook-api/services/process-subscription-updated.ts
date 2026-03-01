import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/index.js";
import { updateMemberWithValidation } from "../../shared-api/utils/firestore-helpers.js";
import type {
  MemberDocument,
  SubscriptionStatus,
} from "../../types/member-document.js";
import { findMemberByStripeCustomer } from "./find-member-by-stripe-customer.js";

/**
 * Result of processing a subscription updated event.
 */
export interface SubscriptionUpdatedResult {
  memberId?: string;
  memberFound: boolean;
  statusUpdated: boolean;
  newStatus?: SubscriptionStatus;
}

/**
 * Subscription statuses we react to, mapped to their member document updates.
 */
const STATUS_UPDATES: Record<
  string,
  { subscriptionStatus: SubscriptionStatus; membershipActive: boolean }
> = {
  active: { subscriptionStatus: "active", membershipActive: true },
  past_due: { subscriptionStatus: "past_due", membershipActive: true },
  unpaid: { subscriptionStatus: "unpaid", membershipActive: false },
};

/**
 * Process a customer.subscription.updated Stripe webhook event.
 *
 * Only reacts to status changes we care about:
 * - active: recovered from past_due, set membershipActive=true
 * - past_due: grace period, keep membershipActive=true
 * - unpaid: payment failed, set membershipActive=false
 *
 * Ignores metadata changes, plan changes, and other non-status updates.
 */
export async function processSubscriptionUpdated({
  stripeCustomerId,
  status,
}: {
  stripeCustomerId: string;
  status: string;
}): Promise<SubscriptionUpdatedResult> {
  // Only react to statuses we care about
  const statusUpdate = STATUS_UPDATES[status];
  if (!statusUpdate) {
    logger.info("Ignoring subscription status we don't handle", {
      status,
      stripeCustomerId,
    });
    return {
      memberFound: false,
      statusUpdated: false,
    };
  }

  // Find member by Stripe customer ID
  let member: MemberDocument | undefined;
  try {
    member = await findMemberByStripeCustomer({ stripeCustomerId });
  } catch (error) {
    logger.error("Failed to look up member for subscription update", {
      errorId:
        ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_UPDATED_MEMBER_LOOKUP_FAILED,
      stripeCustomerId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  if (!member) {
    logger.info(
      "No member found for Stripe customer ID during subscription update",
      {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_UPDATED_MEMBER_NOT_FOUND,
        stripeCustomerId,
      },
    );
    return {
      memberFound: false,
      statusUpdated: false,
    };
  }

  // Idempotency: Skip if refunded (terminal state) or already at this status
  if (member.subscriptionStatus === "refunded") {
    logger.info("Member has refunded status, skipping subscription update", {
      memberId: member.uid,
      requestedStatus: status,
    });
    return {
      memberId: member.uid,
      memberFound: true,
      statusUpdated: false,
    };
  }

  if (
    member.subscriptionStatus === statusUpdate.subscriptionStatus &&
    member.membershipActive === statusUpdate.membershipActive
  ) {
    logger.info("Member already at requested subscription status", {
      memberId: member.uid,
      status,
    });
    return {
      memberId: member.uid,
      memberFound: true,
      statusUpdated: false,
      newStatus: statusUpdate.subscriptionStatus,
    };
  }

  // Update member document
  const updates: Partial<MemberDocument> = {
    subscriptionStatus: statusUpdate.subscriptionStatus,
    membershipActive: statusUpdate.membershipActive,
  };

  try {
    await updateMemberWithValidation({
      memberId: member.uid,
      updates,
      operation: "update subscription status",
    });
  } catch (error) {
    logger.error("Failed to update member subscription status", {
      errorId:
        ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_UPDATED_STATUS_UPDATE_FAILED,
      memberId: member.uid,
      status,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  logger.info("Updated member subscription status", {
    memberId: member.uid,
    previousStatus: member.subscriptionStatus,
    newStatus: statusUpdate.subscriptionStatus,
    membershipActive: statusUpdate.membershipActive,
  });

  return {
    memberId: member.uid,
    memberFound: true,
    statusUpdated: true,
    newStatus: statusUpdate.subscriptionStatus,
  };
}
