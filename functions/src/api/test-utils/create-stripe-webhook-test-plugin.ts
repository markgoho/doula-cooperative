import { mock } from "bun:test";
import type { Logger } from "../handler.js";
import { createStripeWebhookPlugin } from "../plugins/stripe-webhook-plugin.js";
import type { StripeWebhookService } from "../services/stripe-webhook/interface.js";
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
        metadata: { name: "Test User" },
      }),
    ),
    isEventProcessed: mock(() => Promise.resolve(false)),
    markEventProcessed: mock(() => Promise.resolve(true)),
    processCheckoutCompleted: mock(() =>
      Promise.resolve({
        userId: "user-123",
        isNewUser: true,
        emailSent: true,
        mailerliteSynced: true,
      }),
    ),
    ...overrides?.stripeWebhookService,
  };

  return createStripeWebhookPlugin({
    stripeWebhookService: defaultStripeWebhookService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
