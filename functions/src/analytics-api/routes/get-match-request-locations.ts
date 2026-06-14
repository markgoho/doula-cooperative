import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { MatchRequestLocationsResponse } from "../schemas/analytics-schemas.js";
import type { AnalyticsService } from "../services/interface.js";

interface GetMatchRequestLocationsLogicParameters {
  adminUid: string;
  analyticsService: AnalyticsService;
  logger: Logger;
  set: { status?: number | string };
}

export async function getMatchRequestLocationsLogic({
  adminUid,
  analyticsService,
  logger,
  set,
}: GetMatchRequestLocationsLogicParameters): Promise<
  MatchRequestLocationsResponse | { error: string }
> {
  try {
    const result = await analyticsService.getMatchRequestLocations({ logger });
    logger.info("Admin fetched match request locations", {
      adminUid,
      locationCount: result.locations.length,
      unmapped: result.unmapped,
    });
    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get match request locations",
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      logger,
      set,
    });
  }
}
