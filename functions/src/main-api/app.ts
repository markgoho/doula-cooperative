import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createContactUsFormPlugin } from "./plugins/contact-us-form-plugin.js";
import { createDoulaMatchFormPlugin } from "./plugins/doula-match-form-plugin.js";
import { createStripeWebhookPlugin } from "./plugins/stripe-webhook-plugin.js";
import { createProfileDeploymentWebhookPlugin } from "./plugins/profile-deployment-webhook-plugin.js";
import { healthRoute } from "./routes/health.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create main-api Elysia app with injectable dependencies.
 * Routes are organized into plugins for modularity:
 * - Contact-us form: Public form submission with reCAPTCHA
 * - Doula match form: Public form submission with reCAPTCHA
 * - Stripe webhook: Payment processing webhooks (Stripe signature auth)
 * - Profile deployment webhook: Profile update notifications (secret auth)
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  // No Elysia prefix needed - Firebase function named "mainApi" already routes requests to /api/*
  return (
    new Elysia({ adapter: node() })
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Health check route (public)
      .get("/health", () => healthRoute())
      // Contact-us form plugin (public with reCAPTCHA)
      .use(createContactUsFormPlugin(services))
      // Doula match form plugin (public with reCAPTCHA)
      .use(createDoulaMatchFormPlugin(services))
      // Stripe webhook plugin (Stripe signature auth)
      .use(createStripeWebhookPlugin(services))
      // Profile deployment webhook plugin (secret auth)
      .use(createProfileDeploymentWebhookPlugin(services))
  );
}

// Export default app instance with real services for production
export const app = createApp();
