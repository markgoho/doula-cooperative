import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ListMatchRequestsResponse } from "../schemas/match-request-schemas.js";
import type { MatchRequestAdminService } from "../services/interface.js";
import type { MatchRequestStatus } from "../services/list-match-requests.js";

interface ListMatchRequestsLogicParameters {
  limit?: number;
  offset?: number;
  status?: MatchRequestStatus;
  adminUid: string;
  matchRequestAdminService: MatchRequestAdminService;
  logger: Logger;
  set: { status?: number | string };
}

export async function listMatchRequestsLogic({
  limit,
  offset,
  status,
  adminUid,
  matchRequestAdminService,
  logger,
  set,
}: ListMatchRequestsLogicParameters): Promise<
  ListMatchRequestsResponse | { error: string }
> {
  try {
    const result = await matchRequestAdminService.listMatchRequests({
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
      ...(status !== undefined && { status }),
      logger,
    });

    logger.info("Admin listed match requests", {
      adminUid,
      resultCount: result.requests.length,
      status,
      total: result.total,
      pendingCount: result.pendingCount,
      processedCount: result.processedCount,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "list match requests",
      errorId: ERROR_IDS.API_ADMIN_LIST_MATCH_REQUESTS_FAILED,
      logger,
      set,
    });
  }
}
