import type { FirebaseResponse } from "../shared-api/types/firebase-response.js";
import { logger as firebaseLogger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import { ERROR_IDS } from "../constants/error-ids.js";
import type { Logger } from "../shared-api/types/logger.js";

/**
 * Profiles API handler that bridges Firebase Functions with Elysia.
 * Converts Firebase request to Web Request, processes through Elysia, and sends response.
 *
 * @param request - Firebase Functions request object
 * @param response - Firebase response object
 * @param logger - Logger instance (injectable for testing)
 */
export async function handleProfilesApi(
  request: Request,
  response: FirebaseResponse,
  logger: Logger = firebaseLogger,
): Promise<void> {
  try {
    // Validate GitHub secrets are configured (required for image operations)
    const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
    const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
    const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      logger.warn("GitHub secrets not configured - image operations will fail", {
        errorId: ERROR_IDS.API_GITHUB_CONFIG_MISSING,
        hasAppId: Boolean(GITHUB_APP_ID),
        hasPrivateKey: Boolean(GITHUB_PRIVATE_KEY),
        hasInstallationId: Boolean(GITHUB_INSTALLATION_ID),
        path: request.url,
        method: request.method,
      });
    }

    const { app } = await import("./app.js");
    const { toWebRequest, sendWebResponse } = await import(
      "../shared-api/adapters.js"
    );

    const webResponse = (await app.handle(
      toWebRequest(request),
    )) as globalThis.Response;
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

    logger.error("Elysia profiles-api handler failed", errorDetails);

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
