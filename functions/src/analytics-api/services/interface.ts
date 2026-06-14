import type { Logger } from "../../shared-api/types/logger.js";
import type {
  CostOffsetRateResponse,
  MatchRequestLocationsResponse,
  MemberSignupsResponse,
  TopPagesResponse,
} from "../schemas/analytics-schemas.js";

export interface AnalyticsService {
  getMemberSignups(options: { logger: Logger }): Promise<MemberSignupsResponse>;
  getCostOffsetRate(options: {
    logger: Logger;
  }): Promise<CostOffsetRateResponse>;
  getMatchRequestLocations(options: {
    logger: Logger;
  }): Promise<MatchRequestLocationsResponse>;
  getTopPages(options: { logger: Logger }): Promise<TopPagesResponse>;
}
