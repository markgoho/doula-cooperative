import { onRequest } from "firebase-functions/v2/https";
import { STRIPE_SECRETS } from "../constants/stripe.js";

export const stripeWebhook = onRequest(
  {
    secrets: [...STRIPE_SECRETS, "MAILGUN_API_KEY"],
  },
  (request, response) =>
    import("./handler.js").then(m => m.handler(request, response)),
);
