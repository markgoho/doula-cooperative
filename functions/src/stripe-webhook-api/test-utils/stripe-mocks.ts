import { STRIPE_API_VERSION } from "@doula-coop/functions-shared/constants/stripe.js";
import type Stripe from "stripe";

/**
 * Creates a mock Stripe event for testing.
 *
 * @param type - The Stripe event type
 * @param data - The event data object
 * @returns A mock Stripe.Event
 */
export function createMockStripeEvent(
  type: string,
  data: Record<string, unknown>,
): Stripe.Event {
  return {
    id: "evt_test_123",
    object: "event",
    api_version: STRIPE_API_VERSION,
    created: Date.now(),
    type,
    data: {
      object: data,
    },
    livemode: false,
    pending_webhooks: 0,
    request: undefined,
  } as unknown as Stripe.Event;
}
