import { logger as firebaseLogger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import type { FirebaseResponse } from "../shared-api/types/firebase-response.js";
import type { Logger } from "../shared-api/types/logger.js";
import { handleElysiaRequest } from "../shared-api/utils/handle-elysia-request.js";

/**
 * Analytics API handler bridging Firebase Functions with Elysia.
 */
export async function handleAnalyticsApi(
  request: Request,
  response: FirebaseResponse,
  logger: Logger = firebaseLogger,
): Promise<void> {
  const { app } = await import("./app.js");
  return handleElysiaRequest({
    app,
    request,
    response,
    logger,
    apiName: "analytics-api",
  });
}
