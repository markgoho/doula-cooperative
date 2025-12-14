import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createContactUsFormPlugin } from "./plugins/contact-us-form-plugin.js";
import { createDoulaMatchFormPlugin } from "./plugins/doula-match-form-plugin.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Health check route.
 * Returns basic API status for monitoring.
 */
function healthRoute() {
  return { status: "ok", api: "forms-api" };
}

/**
 * Create forms-api Elysia app with injectable dependencies.
 * Routes for public form submissions (contact-us and doula-match forms).
 * Both forms use reCAPTCHA verification and save to Firestore.
 *
 * Firebase hosting routes /api/forms/** to this function.
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
      // Contact-us form plugin (public with reCAPTCHA)
      .use(createContactUsFormPlugin(services))
      // Doula match form plugin (public with reCAPTCHA)
      .use(createDoulaMatchFormPlugin(services))
  );
}

// Export default app instance with real services for production
export const app = createApp();
