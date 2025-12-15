import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { MatchRequestResponse } from "../schemas/match-request-schemas.js";
import type { MatchRequestAdminService } from "../services/interface.js";

export async function getMatchRequestLogic({
  requestId,
  adminUid,
  matchRequestAdminService,
  logger,
  set,
}: {
  requestId: string;
  adminUid: string;
  matchRequestAdminService: MatchRequestAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MatchRequestResponse | { error: string }> {
  try {
    const result = await matchRequestAdminService.getMatchRequest({
      requestId,
      logger,
    });

    logger.info("Admin retrieved match request", { adminUid, requestId });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get match request",
      errorId: ERROR_IDS.API_ADMIN_GET_MATCH_REQUEST_FAILED,
      logger,
      set,
    });
  }
}
