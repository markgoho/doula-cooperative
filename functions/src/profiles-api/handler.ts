import { logger as firebaseLogger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import { ERROR_IDS } from "../constants/error-ids.js";
import type { FirebaseResponse } from "../shared-api/types/firebase-response.js";
import type { Logger } from "../shared-api/types/logger.js";
import { handleElysiaRequest } from "../shared-api/utils/handle-elysia-request.js";

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
  // Validate GitHub secrets are configured (required for Hugo rebuild triggers)
  const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
  const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
  const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    logger.warn("GitHub secrets not configured - Hugo rebuild triggers will fail", {
      errorId: ERROR_IDS.API_GITHUB_CONFIG_MISSING,
      hasAppId: Boolean(GITHUB_APP_ID),
      hasPrivateKey: Boolean(GITHUB_PRIVATE_KEY),
      hasInstallationId: Boolean(GITHUB_INSTALLATION_ID),
      path: request.url,
      method: request.method,
    });
  }

  const { app } = await import("./app.js");
  return handleElysiaRequest({
    app,
    request,
    response,
    logger,
    apiName: "profiles-api",
  });
}
