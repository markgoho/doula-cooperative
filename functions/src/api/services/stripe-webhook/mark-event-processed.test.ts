import { describe, it } from "bun:test";

/**
 * Tests for markEventProcessed (no Firestore mocking).
 *
 * markEventProcessed tests that mock Firestore internals are an anti-pattern.
 * Instead, the StripeWebhookService interface should be mocked at the route level
 * when testing routes that use it.
 *
 * See routes/stripe-webhook/handle-webhook.test.ts for examples of mocking
 * StripeWebhookService at the service interface level.
 *
 * Integration tests with Firestore emulator would go here if needed.
 */
describe("markEventProcessed", () => {
  it.skip("markEventProcessed tests require Firestore integration or should mock at service interface level", () => {
    // Don't mock Firestore internals (getFirestore, collection, doc, etc.)
    // Instead, mock the StripeWebhookService interface when testing routes
    //
    // Example in webhook route test:
    // const mockStripeWebhookService = {
    //   markEventProcessed: mock(() => Promise.resolve(true))
    // };
  });
});
