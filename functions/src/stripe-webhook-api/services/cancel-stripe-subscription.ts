import { logger } from "firebase-functions/v2";
import Stripe from "stripe";
import { ERROR_IDS } from "../../constants/error-ids.js";

/**
 * Cancel a Stripe subscription.
 * Handles the "resource_missing" error gracefully (subscription already canceled).
 *
 * @param subscriptionId - The Stripe subscription ID to cancel
 * @throws Error if STRIPE_API_KEY is not configured or if the Stripe API call fails
 */
export async function cancelStripeSubscription({
  subscriptionId,
}: {
  subscriptionId: string;
}): Promise<void> {
  const stripeApiKey = process.env["STRIPE_API_KEY"];

  if (!stripeApiKey) {
    logger.error("STRIPE_API_KEY not configured, cannot cancel subscription", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_SUBSCRIPTION_CANCEL_FAILED,
      subscriptionId,
    });
    throw new Error("STRIPE_API_KEY not configured");
  }

  const stripe = new Stripe(stripeApiKey);

  try {
    await stripe.subscriptions.cancel(subscriptionId);
    logger.info("Stripe subscription canceled", { subscriptionId });
  } catch (error) {
    // Handle already-canceled subscription gracefully
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      logger.info("Stripe subscription already canceled or not found", {
        subscriptionId,
      });
      return;
    }

    logger.error("Failed to cancel Stripe subscription", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_SUBSCRIPTION_CANCEL_FAILED,
      subscriptionId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
