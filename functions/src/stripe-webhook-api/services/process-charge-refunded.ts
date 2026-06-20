import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import { cancelStripeSubscription } from "./cancel-stripe-subscription.js";
import { findMemberByStripeCustomer } from "./find-member-by-stripe-customer.js";
import {
  processRefundActions,
  type RefundActionsResult,
} from "./process-refund-actions.js";

/**
 * Result of processing a charge.refunded webhook event.
 */
export interface ChargeRefundedResult {
  memberId?: string;
  memberFound: boolean;
  subscriptionCanceled: boolean;
  refundActions: RefundActionsResult;
}

/**
 * Process a charge.refunded Stripe webhook event.
 *
 * 1. Find the member by Stripe customer ID
 * 2. Cancel the Stripe subscription (prevent future charges)
 * 3. Deactivate membership, draft profile, unsubscribe from newsletter
 */
export async function processChargeRefunded({
  stripeCustomerId,
  emailService,
}: {
  stripeCustomerId: string;
  emailService?: EmailServiceInterface;
}): Promise<ChargeRefundedResult> {
  // Step 1: Find member by Stripe customer ID
  let member;
  try {
    member = await findMemberByStripeCustomer({ stripeCustomerId });
  } catch (error) {
    logger.error("Failed to look up member by Stripe customer ID", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_MEMBER_LOOKUP_FAILED,
      stripeCustomerId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  if (!member) {
    logger.info(
      "No member found for Stripe customer ID during refund processing",
      {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_MEMBER_NOT_FOUND,
        stripeCustomerId,
      },
    );
    return {
      memberFound: false,
      subscriptionCanceled: false,
      refundActions: { memberDeactivated: false },
    };
  }

  // Step 2: Cancel subscription (prevent future charges)
  let wasSubscriptionCanceled = false;
  if (member.stripeSubscriptionId) {
    await cancelStripeSubscription({
      subscriptionId: member.stripeSubscriptionId,
    });
    wasSubscriptionCanceled = true;
  }

  // Step 3: Process refund actions (deactivate, draft profile, unsubscribe)
  const refundActions = await processRefundActions({
    memberId: member.uid,
    member,
    reason: "Stripe refund",
    ...(emailService !== undefined && { emailService }),
  });

  return {
    memberId: member.uid,
    memberFound: true,
    subscriptionCanceled: wasSubscriptionCanceled,
    refundActions,
  };
}
