import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { TopPagesResponse } from "../schemas/analytics-schemas.js";
import type { AnalyticsService } from "../services/interface.js";

interface GetTopPagesLogicParameters {
  adminUid: string;
  analyticsService: AnalyticsService;
  logger: Logger;
  set: { status?: number | string };
}

export async function getTopPagesLogic({
  adminUid,
  analyticsService,
  logger,
  set,
}: GetTopPagesLogicParameters): Promise<TopPagesResponse | { error: string }> {
  try {
    const result = await analyticsService.getTopPages({ logger });
    logger.info("Admin fetched top pages", {
      adminUid,
      pageCount: result.pages.length,
    });
    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get top pages",
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      logger,
      set,
    });
  }
}
