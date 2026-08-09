import type { Request } from "firebase-functions/v2/https";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { sendWebResponse, toWebRequest } from "../adapters.js";
import type { FirebaseResponse } from "../types/firebase-response.js";
import type { Logger } from "../types/logger.js";

/**
 * Elysia app interface for handling requests.
 */
interface ElysiaApp {
  handle(request: globalThis.Request): Promise<globalThis.Response>;
}

/**
 * Options for handling an Elysia request.
 */
interface HandleElysiaRequestOptions {
  /**
  The Elysia app instance to handle the request
  */
  app: ElysiaApp;
  /**
  Firebase Functions request object
  */
  request: Request;
  /**
  Firebase response object
  */
  response: FirebaseResponse;
  /**
  Logger instance for error reporting
  */
  logger: Logger;
  /**
  API name for error logging (e.g., "members-api", "admin-members-api")
  */
  apiName: string;
}

/**
 * Shared handler logic for Elysia-based Firebase Functions.
 * Converts Firebase request to Web Request, processes through Elysia, and sends response.
 *
 * @param options - Handler options including app, request, response, logger, and apiName
 */
export async function handleElysiaRequest({
  app,
  request,
  response,
  logger,
  apiName,
}: HandleElysiaRequestOptions): Promise<void> {
  try {
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

    logger.error(`Elysia ${apiName} handler failed`, errorDetails);

    // Only send response if headers haven't been sent yet
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
