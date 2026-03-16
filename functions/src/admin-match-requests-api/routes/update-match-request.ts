import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import type { UpdateMatchRequestResponse } from "../schemas/match-request-schemas.js";
import type { MatchRequestAdminService } from "../services/interface.js";

export async function updateMatchRequestLogic({
  requestId,
  sent,
  adminUid,
  matchRequestAdminService,
  logger,
  set,
}: {
  requestId: string;
  sent: boolean;
  adminUid: string;
  matchRequestAdminService: MatchRequestAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<UpdateMatchRequestResponse | { error: string }> {
  try {
    const result = await matchRequestAdminService.updateMatchRequest({
      requestId,
      sent,
      logger,
    });

    logger.info("Admin updated match request", {
      adminUid,
      requestId,
      sent,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "update match request",
      errorId: ERROR_IDS.API_ADMIN_UPDATE_MATCH_REQUEST_FAILED,
      logger,
      set,
    });
  }
}
