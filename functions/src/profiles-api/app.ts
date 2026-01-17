import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createProfilesPlugin } from "./plugins/profiles-plugin.js";
import { healthRoute } from "./routes/health.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create profiles-api Elysia app with injectable dependencies.
 * Routes for user profile management (authenticated user guard).
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  // Firebase hosting routes /api/profiles/** to this function
  //
  // IMPORTANT: Firebase Hosting sends the FULL path (doesn't strip prefix)
  // Angular proxy.conf.json is configured to also send the full path (no pathRewrite)
  // This ensures local and production behave identically
  return (
    new Elysia({ adapter: node(), prefix: "/api/profiles" })
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Health check route (public)
      .get("/health", () => healthRoute())
      // Profile management routes plugin (includes both public and authenticated routes)
      .use(createProfilesPlugin(services))
  );
}

// Export default app instance with real services for production
export const app = createApp();
