import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createAdminMessagesPlugin } from "./plugins/admin-messages-plugin.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create admin-messages-api Elysia app with injectable dependencies.
 *
 * Firebase Hosting sends the full path - prefix required (see admin-members-api).
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  return new Elysia({ adapter: node(), prefix: "/api/admin/messages" })
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .use(createAdminMessagesPlugin(services));
}

export const app = createApp();
