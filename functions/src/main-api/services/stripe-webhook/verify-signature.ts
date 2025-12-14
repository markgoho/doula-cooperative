import { logger } from "firebase-functions/v2";
import Stripe from "stripe";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import {
  StripeConfigurationError,
  StripeSignatureError,
} from "../../../shared-api/errors/stripe-errors.js";

/**
 * Verify Stripe webhook signature and construct the event.
 *
 * @param options - Raw body buffer and signature header
 * @returns Validated Stripe event
 * @throws StripeConfigurationError if Stripe secrets are not configured
 * @throws StripeSignatureError if signature verification fails
 */
export function verifySignature(options: {
  rawBody: Buffer;
  signature: string;
}): Stripe.Event {
  const { rawBody, signature } = options;

  const stripeApiKey = process.env["STRIPE_API_KEY"];
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

  if (!stripeApiKey || !webhookSecret) {
    logger.error("Missing required Stripe secrets", {
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_CONFIG,
      hasApiKey: Boolean(stripeApiKey),
      hasWebhookSecret: Boolean(webhookSecret),
    });
    throw new StripeConfigurationError("Stripe integration not configured");
  }

  let stripe: Stripe;
  try {
    stripe = new Stripe(stripeApiKey);
  } catch (error) {
    logger.error("Failed to initialize Stripe client", {
      error,
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_CONFIG,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new StripeConfigurationError("Invalid Stripe configuration");
  }

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logger.error("Webhook signature verification failed", {
      error,
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_INVALID_SIGNATURE,
      signatureLength: signature.length,
    });
    throw new StripeSignatureError("Webhook signature verification failed");
  }
}
