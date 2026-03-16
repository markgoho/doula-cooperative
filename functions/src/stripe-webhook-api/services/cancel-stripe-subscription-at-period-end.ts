import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { logger } from "firebase-functions/v2";
import Stripe from "stripe";

/**
 * Cancel a Stripe subscription at the end of the current billing period.
 * Sets cancel_at_period_end to true so the member retains access until their
 * subscription naturally expires.
 *
 * Handles the "resource_missing" error gracefully (subscription already canceled).
 *
 * @param subscriptionId - The Stripe subscription ID to cancel at period end
 * @throws Error if STRIPE_API_KEY is not configured or if the Stripe API call fails
 */
export async function cancelStripeSubscriptionAtPeriodEnd({
  subscriptionId,
}: {
  subscriptionId: string;
}): Promise<void> {
  const stripeApiKey = process.env["STRIPE_API_KEY"];

  if (!stripeApiKey) {
    logger.error(
      "STRIPE_API_KEY not configured, cannot cancel subscription at period end",
      {
        errorId: ERROR_IDS.API_ADMIN_CANCEL_STRIPE_FAILED,
        subscriptionId,
      },
    );
    throw new Error("STRIPE_API_KEY not configured");
  }

  const stripe = new Stripe(stripeApiKey);

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    logger.info("Stripe subscription set to cancel at period end", {
      subscriptionId,
    });
  } catch (error) {
    // Handle already-canceled subscription gracefully
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      logger.info(
        "Stripe subscription already canceled or not found, skipping period-end cancellation",
        {
          subscriptionId,
        },
      );
      return;
    }

    logger.error("Failed to cancel Stripe subscription at period end", {
      errorId: ERROR_IDS.API_ADMIN_CANCEL_STRIPE_FAILED,
      subscriptionId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
