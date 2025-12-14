import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createProfileWebhookPlugin } from "./plugins/profile-webhook-plugin.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Health check route.
 * Returns basic API status for monitoring.
 */
function healthRoute() {
  return { status: "ok", api: "profile-webhook-api" };
}

/**
 * Create profile-webhook-api Elysia app with injectable dependencies.
 * Handles profile deployment webhook notifications from GitHub Actions.
 * Uses secret-based authentication (not Firebase Auth).
 *
 * Firebase hosting routes /api/profile-webhook to this function.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  return (
    new Elysia({ adapter: node() })
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Health check route (public)
      .get("/health", () => healthRoute())
      // Profile webhook plugin (secret auth)
      .use(createProfileWebhookPlugin(services))
  );
}

// Export default app instance with real services for production
export const app = createApp();
