import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { CostOffsetRateResponse } from "../schemas/analytics-schemas.js";
import type { AnalyticsService } from "../services/interface.js";

interface GetCostOffsetRateLogicParameters {
  adminUid: string;
  analyticsService: AnalyticsService;
  logger: Logger;
  set: { status?: number | string };
}

export async function getCostOffsetRateLogic({
  adminUid,
  analyticsService,
  logger,
  set,
}: GetCostOffsetRateLogicParameters): Promise<
  CostOffsetRateResponse | { error: string }
> {
  try {
    const result = await analyticsService.getCostOffsetRate({ logger });
    logger.info("Admin fetched cost offset rate", {
      adminUid,
      total: result.total,
      withOffset: result.withOffset,
    });
    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get cost offset rate",
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      logger,
      set,
    });
  }
}
