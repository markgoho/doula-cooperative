import { EmailService } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { handleStripeWebhookLogic } from "../routes/handle-webhook.js";
import { StripeWebhookApiResponseSchema } from "../schemas/stripe-webhook-schemas.js";
import { StripeWebhookService } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

export function createStripeWebhookPlugin(services?: PartialServices) {
  return new Elysia({ name: "stripe-webhook" })
    .state("rawBody", Buffer.alloc(0))
    .decorate(
      SERVICE_KEYS.STRIPE_WEBHOOK_SERVICE,
      services?.stripeWebhookService ?? StripeWebhookService,
    )
    .decorate(
      SERVICE_KEYS.EMAIL_SERVICE,
      services?.emailService ?? EmailService,
    )
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .post(
      "/webhook",
      async ({
        request,
        store,
        stripeWebhookService,
        emailService,
        logger,
        set,
      }) => {
        const rawBody = (store as { rawBody: Buffer }).rawBody;
        const stripeSignature =
          request.headers.get("stripe-signature") ?? undefined;

        return handleStripeWebhookLogic({
          rawBody,
          stripeSignature,
          stripeWebhookService,
          emailService,
          logger,
          set,
        });
      },
      {
        parse: () => void 0,
        response: StripeWebhookApiResponseSchema,
      },
    );
}
