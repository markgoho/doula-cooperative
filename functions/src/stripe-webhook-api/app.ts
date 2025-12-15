import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createStripeWebhookPlugin } from "./plugins/stripe-webhook-plugin.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Health check route.
 * Returns basic API status for monitoring.
 */
function healthRoute() {
  return { status: "ok", api: "stripe-webhook-api" };
}

/**
 * Create stripe-webhook-api Elysia app with injectable dependencies.
 * Handles Stripe webhook events with signature verification.
 *
 * Firebase hosting routes /api/stripe-webhook to this function.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  // Firebase hosting routes /api/stripe/** to this function
  // IMPORTANT: Firebase Hosting sends the FULL path (doesn't strip prefix)
  return (
    new Elysia({ adapter: node(), prefix: "/api/stripe" })
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Health check route (public)
      .get("/health", () => healthRoute())
      // Stripe webhook plugin (Stripe signature auth)
      .use(createStripeWebhookPlugin(services))
  );
}

// Export default app instance with real services for production
export const app = createApp();
