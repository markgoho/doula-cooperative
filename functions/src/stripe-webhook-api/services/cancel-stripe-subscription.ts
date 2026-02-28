import { logger } from "firebase-functions/v2";
import Stripe from "stripe";

/**
 * Cancel a Stripe subscription.
 * Handles the "resource_missing" error gracefully (subscription already canceled).
 *
 * @param subscriptionId - The Stripe subscription ID to cancel
 * @returns true if canceled successfully or already canceled, false if unexpected error
 */
export async function cancelStripeSubscription({
  subscriptionId,
}: {
  subscriptionId: string;
}): Promise<boolean> {
  const stripeApiKey = process.env["STRIPE_API_KEY"];

  if (!stripeApiKey) {
    logger.error("STRIPE_API_KEY not configured, cannot cancel subscription", {
      subscriptionId,
    });
    return false;
  }

  const stripe = new Stripe(stripeApiKey);

  try {
    await stripe.subscriptions.cancel(subscriptionId);
    logger.info("Stripe subscription canceled", { subscriptionId });
    return true;
  } catch (error) {
    // Handle already-canceled subscription gracefully
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      logger.info("Stripe subscription already canceled or not found", {
        subscriptionId,
      });
      return true;
    }

    logger.error("Failed to cancel Stripe subscription", {
      subscriptionId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}
