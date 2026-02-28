import { logger } from "firebase-functions/v2";
import Stripe from "stripe";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import { retrieveAndValidateMember } from "../../shared-api/utils/firestore-helpers.js";
import { cancelStripeSubscription } from "../../stripe-webhook-api/services/cancel-stripe-subscription.js";
import {
  processRefundActions,
  type RefundActionsResult,
} from "../../stripe-webhook-api/services/process-refund-actions.js";
import type { MemberDocument } from "../../types/member-document.js";

/**
 * Result of an admin-initiated refund.
 */
export interface RefundMembershipResult {
  member: MemberDocument;
  stripeRefundCreated: boolean;
  subscriptionCanceled: boolean;
  refundActions: RefundActionsResult;
}

/**
 * Refund a member's Stripe payment, cancel their subscription,
 * and deactivate their membership.
 *
 * Called from the admin API. The resulting Stripe charge.refunded webhook
 * is handled idempotently by processRefundActions (skips if already refunded).
 */
export async function refundMembership({
  memberId,
  reason,
  emailService,
}: {
  memberId: string;
  reason?: string;
  emailService?: EmailServiceInterface;
}): Promise<RefundMembershipResult> {
  // Step 1: Verify member exists and has Stripe data
  const member = await retrieveAndValidateMember({ memberId });

  if (!member.stripeCustomerId || !member.stripeSubscriptionId) {
    logger.warn("Refund attempted for member without Stripe data", {
      errorId: ERROR_IDS.API_ADMIN_REFUND_NO_STRIPE_DATA,
      memberId,
    });
    throw new ValidationError(
      "Member does not have Stripe subscription data. Use manual deactivation instead.",
    );
  }

  const stripeApiKey = process.env["STRIPE_API_KEY"];

  if (!stripeApiKey) {
    throw new Error("STRIPE_API_KEY not configured");
  }

  const stripe = new Stripe(stripeApiKey);

  // Step 2: Find latest charge for this customer
  let latestChargeId: string | undefined;
  try {
    const charges = await stripe.charges.list({
      customer: member.stripeCustomerId,
      limit: 1,
    });

    const latestCharge = charges.data[0];

    if (!latestCharge) {
      throw new NotFoundError("No charges found for this customer");
    }

    latestChargeId = latestCharge.id;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error("Failed to list Stripe charges", {
      errorId: ERROR_IDS.API_ADMIN_REFUND_STRIPE_API_FAILED,
      memberId,
      stripeCustomerId: member.stripeCustomerId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  // Step 3: Create refund
  let stripeRefundCreated = false;
  try {
    const refund = await stripe.refunds.create({
      charge: latestChargeId,
    });

    stripeRefundCreated = true;
    logger.info("Stripe refund created", {
      memberId,
      chargeId: latestChargeId,
      refundId: refund.id,
    });
  } catch (error) {
    // If refund is already done, that's okay - continue with deactivation
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "charge_already_refunded"
    ) {
      logger.info("Charge already refunded, continuing with deactivation", {
        memberId,
        chargeId: latestChargeId,
      });
      stripeRefundCreated = true;
    } else {
      logger.error("Failed to create Stripe refund", {
        errorId: ERROR_IDS.API_ADMIN_REFUND_STRIPE_API_FAILED,
        memberId,
        chargeId: latestChargeId,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Step 4: Cancel subscription
  let subscriptionCanceled = false;
  try {
    await cancelStripeSubscription({
      subscriptionId: member.stripeSubscriptionId,
    });
    subscriptionCanceled = true;
  } catch (error) {
    logger.error("Failed to cancel subscription during admin refund", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_SUBSCRIPTION_CANCEL_FAILED,
      memberId,
      stripeSubscriptionId: member.stripeSubscriptionId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  // Step 5: Process refund actions (deactivate, draft profile, unsubscribe)
  const refundActions = await processRefundActions({
    memberId,
    member,
    reason: reason ?? "Admin-initiated refund",
    ...(emailService !== undefined && { emailService }),
  });

  // Step 6: Retrieve updated member document
  const updatedMember = await retrieveAndValidateMember({ memberId });

  return {
    member: updatedMember,
    stripeRefundCreated,
    subscriptionCanceled,
    refundActions,
  };
}
