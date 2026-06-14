import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createAnalyticsPlugin } from "./plugins/analytics-plugin.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create analytics-api Elysia app with injectable dependencies.
 *
 * Firebase Hosting sends the full path - prefix required.
 */
export function createApp(services?: PartialServices) {
  return new Elysia({ adapter: node(), prefix: "/api/analytics" })
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .use(createAnalyticsPlugin(services));
}

export const app = createApp();
