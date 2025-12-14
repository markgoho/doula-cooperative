import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createAdminMembersPlugin } from "./plugins/admin-members-plugin.js";
import { createMembersPlugin } from "./plugins/members-plugin.js";
import { createStripeWebhookPlugin } from "./plugins/stripe-webhook-plugin.js";
import { healthRoute } from "./routes/health.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create Elysia app with injectable dependencies.
 * Routes are organized into plugins for modularity:
 * - Admin member routes: Use guard for centralized admin auth
 * - Member routes: Use owner-or-admin auth in logic functions
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  // No Elysia prefix needed - Firebase function named "api" already routes requests to /api/*
  return (
    new Elysia({ adapter: node() })
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Health check route (public)
      .get("/health", () => healthRoute())
      // Member routes plugin (owner-or-admin auth)
      .use(createMembersPlugin(services))
      // Admin member management routes plugin (admin guard)
      .use(createAdminMembersPlugin(services))
      // Stripe webhook plugin (Stripe signature auth)
      .use(createStripeWebhookPlugin(services))
  );
}

// Export default app instance with real services for production
export const app = createApp();
