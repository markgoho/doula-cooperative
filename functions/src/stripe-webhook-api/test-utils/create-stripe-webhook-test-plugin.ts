import { mock } from "bun:test";
import type { Logger } from "../../shared-api/types/logger.js";
import { createStripeWebhookPlugin } from "../plugins/stripe-webhook-plugin.js";
import type { StripeWebhookService } from "../services/interface.js";
import { createMockStripeEvent } from "./stripe-mocks.js";

/**
 * Creates the stripe-webhook plugin with default mock services for testing.
 * Tests only the webhook plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured stripe webhook plugin with mocked services
 */
export function createStripeWebhookTestPlugin(overrides?: {
  stripeWebhookService?: Partial<StripeWebhookService>;
  logger?: Logger;
}) {
  const defaultStripeWebhookService: StripeWebhookService = {
    verifySignature: mock(() =>
      createMockStripeEvent("checkout.session.completed", {
        id: "cs_test_123",
        customer_details: { email: "test@example.com" },
      }),
    ),
    isEventProcessed: mock(() => Promise.resolve(false)),
    markEventProcessed: mock(() => Promise.resolve(true)), // Returns true = event was newly marked
    processCheckoutCompleted: mock(() =>
      Promise.resolve({
        userId: "test-user-123",
        isNewUser: true,
        emailSent: true,
        mailerliteSynced: true,
      }),
    ),
    processChargeRefunded: mock(() =>
      Promise.resolve({
        memberId: "test-member-123",
        memberFound: true,
        subscriptionCanceled: true,
        refundActions: {
          memberDeactivated: true,
        },
      }),
    ),
    ...overrides?.stripeWebhookService,
  };

  return createStripeWebhookPlugin({
    stripeWebhookService: defaultStripeWebhookService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
