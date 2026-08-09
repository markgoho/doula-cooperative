import { wasAlreadyProcessed } from "./check-idempotency.js";
import type { StripeWebhookService as StripeWebhookServiceInterface } from "./interface.js";
import { wasEventMarkedAsProcessed } from "./mark-event-processed.js";
import { processChargeRefunded } from "./process-charge-refunded.js";
import { processCheckoutCompleted } from "./process-checkout-completed.js";
import { processSubscriptionEnded } from "./process-subscription-ended.js";
import { processSubscriptionUpdated } from "./process-subscription-updated.js";
import { verifySignature } from "./verify-signature.js";

/**
 * Service for handling Stripe webhook operations.
 * Includes signature verification, idempotency checks, and checkout processing.
 */
export const StripeWebhookService: StripeWebhookServiceInterface = {
  verifySignature,
  isEventProcessed: wasAlreadyProcessed,
  wasEventMarkedAsProcessed,
  processCheckoutCompleted,
  processChargeRefunded,
  processSubscriptionEnded,
  processSubscriptionUpdated,
};

// Re-export individual functions for direct imports
export { wasAlreadyProcessed } from "./check-idempotency.js";
export { wasEventMarkedAsProcessed } from "./mark-event-processed.js";
export { processChargeRefunded } from "./process-charge-refunded.js";
export { processCheckoutCompleted } from "./process-checkout-completed.js";
export { processSubscriptionEnded } from "./process-subscription-ended.js";
export { processSubscriptionUpdated } from "./process-subscription-updated.js";
export { verifySignature } from "./verify-signature.js";
