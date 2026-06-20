import type Stripe from "stripe";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { ChargeRefundedResult } from "./process-charge-refunded.js";
import type { SubscriptionEndedResult } from "./process-subscription-ended.js";
import type { SubscriptionUpdatedResult } from "./process-subscription-updated.js";

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
   * @throws StripeConfigError if Stripe is not configured
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
   * @param options - The checkout session, email service, and logger
   * @returns Promise resolving to processing result
   * @throws StripeWebhookError if critical operations fail
   */
  processCheckoutCompleted(options: {
    session: Stripe.Checkout.Session;
    emailService: EmailServiceInterface;
    logger: Logger;
  }): Promise<CheckoutCompletedResult>;

  /**
   * Process a charge.refunded event.
   * Finds member, cancels subscription, deactivates membership, drafts profile, unsubscribes newsletter.
   *
   * @param options - Stripe customer ID and email service
   * @returns Promise resolving to refund processing result
   */
  processChargeRefunded(options: {
    stripeCustomerId: string;
    emailService?: EmailServiceInterface;
  }): Promise<ChargeRefundedResult>;

  /**
   * Process a customer.subscription.deleted event.
   * Finds member, deactivates membership, drafts profile, unsubscribes newsletter.
   *
   * @param options - Stripe customer ID and email service
   * @returns Promise resolving to subscription ended result
   */
  processSubscriptionEnded(options: {
    stripeCustomerId: string;
    emailService?: EmailServiceInterface;
  }): Promise<SubscriptionEndedResult>;

  /**
   * Process a customer.subscription.updated event.
   * Reacts to status changes: active, past_due, unpaid.
   *
   * @param options - Stripe customer ID and subscription status
   * @returns Promise resolving to subscription updated result
   */
  processSubscriptionUpdated(options: {
    stripeCustomerId: string;
    status: string;
  }): Promise<SubscriptionUpdatedResult>;
}
