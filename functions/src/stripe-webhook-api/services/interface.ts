import type Stripe from "stripe";
import type { Logger } from "../../shared-api/types/logger.js";

/**
 * Result of processing a checkout session completion.
 */
export interface CheckoutCompletedResult {
  userId: string;
  isNewUser: boolean;
  emailSent: boolean;
  mailerliteSynced: boolean;
  warning?: string;
}

/**
 * Service interface for Stripe webhook operations.
 * Handles signature verification, idempotency, and checkout processing.
 */
export interface StripeWebhookService {
  /**
   * Verify Stripe webhook signature and construct the event.
   *
   * @param options - Raw body and signature header
   * @returns Validated Stripe event
   * @throws StripeSignatureError if signature is invalid
   * @throws StripeConfigurationError if Stripe is not configured
   */
  verifySignature(options: {
    rawBody: Buffer;
    signature: string;
  }): Stripe.Event;

  /**
   * Check if an event has already been processed (idempotency).
   *
   * @param eventId - The Stripe event ID
   * @returns Promise resolving to true if already processed
   */
  isEventProcessed(eventId: string): Promise<boolean>;

  /**
   * Mark an event as processed atomically.
   * Uses Firestore create() to prevent race conditions.
   *
   * @param options - Event ID and type
   * @returns Promise resolving to true if successfully marked, false if already exists
   */
  markEventProcessed(options: {
    eventId: string;
    eventType: string;
  }): Promise<boolean>;

  /**
   * Process a checkout.session.completed event.
   * Creates/updates user and member, adds to newsletter, sends welcome email.
   *
   * @param options - The checkout session and logger
   * @returns Promise resolving to processing result
   * @throws StripeWebhookError if critical operations fail
   */
  processCheckoutCompleted(options: {
    session: Stripe.Checkout.Session;
    logger: Logger;
  }): Promise<CheckoutCompletedResult>;
}
