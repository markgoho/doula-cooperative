import { checkIdempotency } from "./check-idempotency.js";
import type { StripeWebhookService as StripeWebhookServiceInterface } from "./interface.js";
import { markEventProcessed } from "./mark-event-processed.js";
import { processCheckoutCompleted } from "./process-checkout-completed.js";
import { verifySignature } from "./verify-signature.js";

/**
 * Service for handling Stripe webhook operations.
 * Includes signature verification, idempotency checks, and checkout processing.
 */
export const StripeWebhookService: StripeWebhookServiceInterface = {
  verifySignature,
  isEventProcessed: checkIdempotency,
  markEventProcessed,
  processCheckoutCompleted,
};

// Re-export individual functions for direct imports
export { checkIdempotency } from "./check-idempotency.js";
export { markEventProcessed } from "./mark-event-processed.js";
export { processCheckoutCompleted } from "./process-checkout-completed.js";
export { verifySignature } from "./verify-signature.js";
