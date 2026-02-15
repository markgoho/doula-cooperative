import { logger as firebaseLogger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import { ERROR_IDS } from "../constants/error-ids.js";
import { sendWebResponse, toWebRequest } from "../shared-api/adapters.js";
import type { FirebaseResponse } from "../shared-api/types/firebase-response.js";
import type { Logger } from "../shared-api/types/logger.js";

export async function handleStripeWebhookApi(
  request: Request,
  response: FirebaseResponse,
  logger: Logger = firebaseLogger,
): Promise<void> {
  try {
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
    const { createApp } = await import("./app.js");
    const app = createApp({ rawBody });

    const webResponse = await app.handle(toWebRequest(request));
    await sendWebResponse(webResponse, response);
  } catch (error) {
    const errorDetails = {
      errorId: ERROR_IDS.API_HANDLER_FAILED,
      path: request.url,
      method: request.method,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    logger.error(`Elysia stripe-webhook-api handler failed`, errorDetails);

    if (response.headersSent) {
      logger.warn("Cannot send error response - headers already sent", {
        errorId: ERROR_IDS.API_HEADERS_ALREADY_SENT,
        path: request.url,
        method: request.method,
      });
    } else {
      response.status(500).json({
        error: "Internal server error",
        message:
          "An unexpected error occurred while processing your request. Please try again later.",
      });
    }
  }
}
