import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { handleStripeWebhookLogic } from "../routes/stripe-webhook/handle-webhook.js";
import { StripeWebhookService } from "../services/stripe-webhook/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create Stripe webhook plugin.
 *
 * This plugin handles Stripe webhook events at POST /stripe/webhook.
 * It does NOT use Firebase Auth - authentication is via Stripe signature verification.
 *
 * IMPORTANT: This route requires raw body access for signature verification.
 * We disable Elysia's body parsing by setting parse to return undefined.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with Stripe webhook route
 */
export function createStripeWebhookPlugin(services?: PartialServices) {
  return new Elysia({ name: "stripe-webhook" })
    .decorate(
      SERVICE_KEYS.STRIPE_WEBHOOK_SERVICE,
      services?.stripeWebhookService ?? StripeWebhookService,
    )
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .post(
      "/stripe/webhook",
      async ({ request, stripeWebhookService, logger, set }) => {
        // Get raw body for signature verification
        const rawBody = Buffer.from(await request.arrayBuffer());
        const stripeSignature =
          request.headers.get("stripe-signature") ?? undefined;

        return handleStripeWebhookLogic({
          rawBody,
          stripeSignature,
          stripeWebhookService,
          logger,
          set,
        });
      },
      {
        // Disable body parsing to preserve raw body for Stripe signature verification
        // Using void 0 (evaluates to undefined) to skip Elysia's body parsing
        parse: () => void 0,
      },
    );
}
