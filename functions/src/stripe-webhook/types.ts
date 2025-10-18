import Stripe from "stripe";

export interface CheckoutSessionCompletedEvent {
  type: "checkout.session.completed";
  data: {
    object: Stripe.Checkout.Session;
  };
}

export type StripeWebhookEvent = CheckoutSessionCompletedEvent | Stripe.Event;
