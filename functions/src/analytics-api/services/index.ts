import { getMemberSignups } from "./get-member-signups.js";
import { getCostOffsetRate } from "./get-cost-offset-rate.js";
import { getMatchRequestLocations } from "./get-match-request-locations.js";
import { getTopPages } from "./get-top-pages.js";
import type { AnalyticsService } from "./interface.js";

export const AnalyticsServiceImpl: AnalyticsService = {
  getMemberSignups,
  getCostOffsetRate,
  getMatchRequestLocations,
  getTopPages,
};
