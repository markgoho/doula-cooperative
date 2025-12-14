import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../errors/http-error.js";
import {
  StripeConfigurationError,
  StripeSignatureError,
} from "../../errors/stripe-errors.js";
import type { Logger } from "../../handler.js";
import type {
  StripeWebhookErrorResponse,
  StripeWebhookResponse,
} from "../../schemas/stripe-webhook-schemas.js";
import type { StripeWebhookService } from "../../services/stripe-webhook/interface.js";

/**
 * Handle Stripe webhook requests.
 * Verifies signature, checks idempotency, and processes supported events.
 */
export async function handleStripeWebhookLogic(options: {
  rawBody: Buffer;
  stripeSignature: string | undefined;
  stripeWebhookService: StripeWebhookService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<StripeWebhookResponse | StripeWebhookErrorResponse> {
  const { rawBody, stripeSignature, stripeWebhookService, logger, set } =
    options;

  // Step 1: Validate signature header presence
  if (!stripeSignature) {
    logger.error("Missing stripe-signature header", {
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_SIGNATURE,
    });
    set.status = 400;
    return {
      error: "Missing signature",
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_SIGNATURE,
    };
  }

  // Step 2: Verify signature and construct event
  let event;
  try {
    event = stripeWebhookService.verifySignature({
      rawBody,
      signature: stripeSignature,
    });
  } catch (error) {
    if (error instanceof StripeSignatureError) {
      set.status = 400;
      return {
        error: error.message,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_INVALID_SIGNATURE,
      };
    }
    if (error instanceof StripeConfigurationError) {
      set.status = 500;
      return {
        error: error.message,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_CONFIG,
      };
    }
    // Unexpected error
    logger.error("Unexpected error during signature verification", {
      error,
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
    });
    set.status = 500;
    return {
      error: "Internal server error",
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
    };
  }

  // Step 3: Handle checkout.session.completed events
  if (event.type === "checkout.session.completed") {
    // Step 3a: Check idempotency - try to mark event as processed atomically
    const wasMarked = await stripeWebhookService.markEventProcessed({
      eventId: event.id,
      eventType: event.type,
    });

    if (!wasMarked) {
      // Event was already processed
      logger.info(`Event ${event.id} already processed, skipping`, {
        eventId: event.id,
        eventType: event.type,
      });
      return { received: true, duplicate: true };
    }

    // Step 3b: Process the checkout session
    try {
      const result = await stripeWebhookService.processCheckoutCompleted({
        session: event.data.object,
        logger,
      });

      return {
        received: true,
        userId: result.userId,
        isNewUser: result.isNewUser,
        emailSent: result.emailSent,
        mailerliteSynced: result.mailerliteSynced,
        ...(result.warning && { warning: result.warning }),
      };
    } catch (error) {
      if (error instanceof HttpError) {
        set.status = error.statusCode;
        return { error: error.message };
      }

      logger.error("Unexpected error processing checkout", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
        eventId: event.id,
      });
      set.status = 500;
      return {
        error: "Internal server error",
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
      };
    }
  }

  // Step 4: Acknowledge unhandled event types
  logger.warn(`Unhandled event type: ${event.type}`, {
    errorId: ERROR_IDS.STRIPE_WEBHOOK_UNHANDLED_EVENT,
    eventType: event.type,
  });
  return { received: true };
}
