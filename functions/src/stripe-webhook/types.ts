import Stripe from "stripe";

/**
 * Webhook events from Stripe that this handler processes.
 * Currently only "checkout.session.completed" is handled.
 */
export type StripeWebhookEvent = Extract<
  Stripe.Event,
  { type: "checkout.session.completed" }
>;

/**
 * Type guard to check if an event is a checkout session completed event.
 */
export function isCheckoutSessionCompleted(
  event: Stripe.Event,
): event is StripeWebhookEvent {
  return event.type === "checkout.session.completed";
}
