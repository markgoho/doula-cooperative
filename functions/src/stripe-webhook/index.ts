import { onRequest } from "firebase-functions/v2/https";
import { MAILERLITE_SECRETS } from "../constants/mailerlite-secrets.js";
import { MAILGUN_SECRETS } from "../constants/mailgun-secrets.js";
import { STRIPE_SECRETS } from "../constants/stripe.js";

export const stripeWebhook = onRequest(
  {
    secrets: [...STRIPE_SECRETS, ...MAILGUN_SECRETS, ...MAILERLITE_SECRETS],
  },
  (request, response) =>
    import("./handler.js").then(m => m.handler(request, response)),
);
