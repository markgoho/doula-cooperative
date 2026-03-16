import type { FirebaseResponse } from "@doula-coop/functions-shared/shared-api/types/firebase-response.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleElysiaRequest } from "@doula-coop/functions-shared/shared-api/utils/handle-elysia-request.js";
import { logger as firebaseLogger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";

/**
 * Admin Unclaimed Profiles API handler that bridges Firebase Functions with Elysia.
 * Converts Firebase request to Web Request, processes through Elysia, and sends response.
 *
 * @param request - Firebase Functions request object
 * @param response - Firebase response object
 * @param logger - Logger instance (injectable for testing)
 */
export async function handleAdminUnclaimedProfilesApi(
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
    apiName: "admin-unclaimed-profiles-api",
  });
}
