import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { MemberSignupsResponse } from "../schemas/analytics-schemas.js";
import type { AnalyticsService } from "../services/interface.js";

interface GetMemberSignupsLogicParameters {
  adminUid: string;
  analyticsService: AnalyticsService;
  logger: Logger;
  set: { status?: number | string };
}

export async function getMemberSignupsLogic({
  adminUid,
  analyticsService,
  logger,
  set,
}: GetMemberSignupsLogicParameters): Promise<
  MemberSignupsResponse | { error: string }
> {
  try {
    const result = await analyticsService.getMemberSignups({ logger });
    logger.info("Admin fetched member signups", {
      adminUid,
      dayCount: result.days.length,
    });
    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get member signups",
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      logger,
      set,
    });
  }
}
