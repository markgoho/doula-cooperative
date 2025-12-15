import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createMembersPlugin } from "./plugins/members-plugin.js";
import { healthRoute } from "./routes/health.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create members-api Elysia app with injectable dependencies.
 * Routes for member self-service (owner-or-admin auth in logic functions).
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  // Firebase hosting routes /api/members/** to this function
  return (
    new Elysia({ adapter: node(), prefix: "/api/members" })
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Health check route (public)
      .get("/health", () => healthRoute())
      // Member routes plugin (owner-or-admin auth)
      .use(createMembersPlugin(services))
  );
}

// Export default app instance with real services for production
export const app = createApp();
