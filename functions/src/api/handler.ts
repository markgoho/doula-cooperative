import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { logger as firebaseLogger } from "firebase-functions/v2";

/**
 * Logger interface for dependency injection.
 * Matches Firebase Functions logger API.
 */
export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug?(message: string, context?: Record<string, unknown>): void;
  log?(message: string, context?: Record<string, unknown>): void;
}

/**
 * Main API handler that bridges Firebase Functions with Elysia.
 * Converts Firebase request to Web Request, processes through Elysia, and sends response.
 *
 * @param request - Firebase Functions request object
 * @param response - Express response object
 * @param logger - Logger instance (injectable for testing)
 */
export async function handleApi(
  request: Request,
  response: Response,
  logger: Logger = firebaseLogger,
): Promise<void> {
  try {
    const { app } = await import("./app.js");
    const { toWebRequest, sendWebResponse } = await import("./adapters.js");

    const webResponse = (await app.handle(
      toWebRequest(request),
    )) as globalThis.Response;
    await sendWebResponse(webResponse, response);
  } catch (error) {
    logger.error("Elysia API handler failed", {
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      path: request.url,
      method: request.method,
    });

    // Only send response if headers haven't been sent yet
    if (!response.headersSent) {
      response.status(500).json({
        error: "Internal server error",
        message:
          "An unexpected error occurred while processing your request. Please try again later.",
      });
    }
  }
}
