import type { FirebaseResponse } from "../shared-api/types/firebase-response.js";
import { logger as firebaseLogger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import type { Logger } from "../shared-api/types/logger.js";
import { handleElysiaRequest } from "../shared-api/utils/handle-elysia-request.js";

/**
 * Forms API handler that bridges Firebase Functions with Elysia.
 * Converts Firebase request to Web Request, processes through Elysia, and sends response.
 *
 * @param request - Firebase Functions request object
 * @param response - Firebase response object
 * @param logger - Logger instance (injectable for testing)
 */
export async function handleFormsApi(
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
    apiName: "forms-api",
  });
}
