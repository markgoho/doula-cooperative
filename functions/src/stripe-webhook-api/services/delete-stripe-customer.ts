import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { logger } from "firebase-functions/v2";
import Stripe from "stripe";

/**
 * Delete a Stripe customer.
 * Handles the "resource_missing" error gracefully (customer already deleted).
 *
 * @param customerId - The Stripe customer ID to delete
 * @throws Error if STRIPE_API_KEY is not configured or if the Stripe API call fails
 */
export async function deleteStripeCustomer({
  customerId,
}: {
  customerId: string;
}): Promise<void> {
  const stripeApiKey = process.env["STRIPE_API_KEY"];

  if (!stripeApiKey) {
    logger.error("STRIPE_API_KEY not configured, cannot delete customer", {
      errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_STRIPE_DELETE_FAILED,
      customerId,
    });
    throw new Error("STRIPE_API_KEY not configured");
  }

  const stripe = new Stripe(stripeApiKey);

  try {
    await stripe.customers.del(customerId);
    logger.info("Stripe customer deleted", { customerId });
  } catch (error) {
    // Handle already-deleted customer gracefully
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      logger.info("Stripe customer already deleted or not found", {
        customerId,
      });
      return;
    }

    logger.error("Failed to delete Stripe customer", {
      errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_STRIPE_DELETE_FAILED,
      customerId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
