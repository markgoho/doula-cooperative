import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import {
  StripeConfigurationError,
  StripeSignatureError,
} from "../../shared-api/errors/stripe-errors.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  StripeWebhookErrorResponse,
  StripeWebhookResponse,
} from "../schemas/stripe-webhook-schemas.js";
import type { StripeWebhookService } from "../services/interface.js";

/**
 * Handle Stripe webhook requests.
 * Verifies signature, checks idempotency, and processes supported events.
 */
export async function handleStripeWebhookLogic(options: {
  rawBody: Buffer;
  stripeSignature: string | undefined;
  stripeWebhookService: StripeWebhookService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<StripeWebhookResponse | StripeWebhookErrorResponse> {
  const {
    rawBody,
    stripeSignature,
    stripeWebhookService,
    emailService,
    logger,
    set,
  } = options;

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
        emailService,
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

  // Step 4: Handle charge.refunded events
  if (event.type === "charge.refunded") {
    // Step 4a: Check idempotency
    const wasMarked = await stripeWebhookService.markEventProcessed({
      eventId: event.id,
      eventType: event.type,
    });

    if (!wasMarked) {
      logger.info(`Event ${event.id} already processed, skipping`, {
        eventId: event.id,
        eventType: event.type,
      });
      return { received: true, duplicate: true };
    }

    // Step 4b: Process the refund
    const charge = event.data.object as { customer?: string | null };
    const stripeCustomerId =
      typeof charge.customer === "string" ? charge.customer : undefined;

    if (!stripeCustomerId) {
      logger.warn("charge.refunded event missing customer ID", {
        eventId: event.id,
      });
      return { received: true, warning: "No customer ID on charge" };
    }

    try {
      const result = await stripeWebhookService.processChargeRefunded({
        stripeCustomerId,
        emailService,
      });

      return {
        received: true,
        ...(result.memberId !== undefined && { userId: result.memberId }),
        ...(result.refundActions.warning !== undefined && {
          warning: result.refundActions.warning,
        }),
      };
    } catch (error) {
      if (error instanceof HttpError) {
        set.status = error.statusCode;
        return { error: error.message };
      }

      logger.error("Unexpected error processing refund", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
        eventId: event.id,
        stripeCustomerId,
      });
      set.status = 500;
      return {
        error: "Internal server error",
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
      };
    }
  }

  // Step 5: Handle customer.subscription.deleted events
  if (event.type === "customer.subscription.deleted") {
    const wasMarked = await stripeWebhookService.markEventProcessed({
      eventId: event.id,
      eventType: event.type,
    });

    if (!wasMarked) {
      logger.info(`Event ${event.id} already processed, skipping`, {
        eventId: event.id,
        eventType: event.type,
      });
      return { received: true, duplicate: true };
    }

    const subscription = event.data.object as { customer?: string | null };
    const stripeCustomerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : undefined;

    if (!stripeCustomerId) {
      logger.warn("customer.subscription.deleted event missing customer ID", {
        eventId: event.id,
      });
      return { received: true, warning: "No customer ID on subscription" };
    }

    try {
      const result = await stripeWebhookService.processSubscriptionEnded({
        stripeCustomerId,
        emailService,
      });

      return {
        received: true,
        ...(result.memberId !== undefined && { userId: result.memberId }),
        ...(result.warning !== undefined && { warning: result.warning }),
      };
    } catch (error) {
      if (error instanceof HttpError) {
        set.status = error.statusCode;
        return { error: error.message };
      }

      logger.error("Unexpected error processing subscription end", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
        eventId: event.id,
        stripeCustomerId,
      });
      set.status = 500;
      return {
        error: "Internal server error",
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
      };
    }
  }

  // Step 6: Handle customer.subscription.updated events
  if (event.type === "customer.subscription.updated") {
    const wasMarked = await stripeWebhookService.markEventProcessed({
      eventId: event.id,
      eventType: event.type,
    });

    if (!wasMarked) {
      logger.info(`Event ${event.id} already processed, skipping`, {
        eventId: event.id,
        eventType: event.type,
      });
      return { received: true, duplicate: true };
    }

    const subscription = event.data.object as {
      customer?: string | null;
      status?: string;
    };
    const stripeCustomerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : undefined;

    if (!stripeCustomerId) {
      logger.warn("customer.subscription.updated event missing customer ID", {
        eventId: event.id,
      });
      return { received: true, warning: "No customer ID on subscription" };
    }

    if (typeof subscription.status !== "string") {
      logger.warn("customer.subscription.updated event missing status", {
        eventId: event.id,
      });
      return { received: true, warning: "No status on subscription" };
    }

    try {
      const result = await stripeWebhookService.processSubscriptionUpdated({
        stripeCustomerId,
        status: subscription.status,
      });

      return {
        received: true,
        ...(result.memberId !== undefined && { userId: result.memberId }),
      };
    } catch (error) {
      if (error instanceof HttpError) {
        set.status = error.statusCode;
        return { error: error.message };
      }

      logger.error("Unexpected error processing subscription update", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
        eventId: event.id,
        stripeCustomerId,
      });
      set.status = 500;
      return {
        error: "Internal server error",
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
      };
    }
  }

  // Step 7: Acknowledge unhandled event types
  logger.warn(`Unhandled event type: ${event.type}`, {
    errorId: ERROR_IDS.STRIPE_WEBHOOK_UNHANDLED_EVENT,
    eventType: event.type,
  });
  return { received: true };
}
