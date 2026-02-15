import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { createStripeWebhookPlugin } from "./plugins/stripe-webhook-plugin.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

function healthRoute() {
  return { status: "ok", api: "stripe-webhook-api" };
}

interface CreateAppOptions {
  services?: PartialServices;
  rawBody?: Buffer;
}

/**
 * Create stripe-webhook-api Elysia app with injectable dependencies.
 *
 * rawBody must be provided per-request because the Elysia node adapter
 * consumes the Web Request body stream during parsing, making
 * request.arrayBuffer() unusable in route handlers. We inject the
 * Firebase rawBody via Elysia state to bypass this limitation.
 */
export function createApp({ services, rawBody }: CreateAppOptions = {}) {
  return new Elysia({ adapter: node(), prefix: "/api/stripe" })
    .state("rawBody", rawBody ?? Buffer.alloc(0))
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .get("/health", () => healthRoute())
    .use(createStripeWebhookPlugin(services));
}
