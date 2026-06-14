import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { adminDerive } from "../../shared-api/utils/admin-derive.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import {
  getCostOffsetRateLogic,
  getMatchRequestLocationsLogic,
  getMemberSignupsLogic,
  getTopPagesLogic,
} from "../routes/index.js";
import { AnalyticsServiceImpl } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Analytics plugin with adminGuard on all routes.
 * Firebase rewrite: /api/analytics/** → analyticsApi function
 */
export function createAnalyticsPlugin(services?: PartialServices) {
  return new Elysia({ name: "analytics" })
    .decorate(
      SERVICE_KEYS.ANALYTICS_SERVICE,
      services?.analyticsService ?? AnalyticsServiceImpl,
    )
    .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .derive(adminDerive)
    .onBeforeHandle({ as: "local" }, adminGuard)
    .get(
      "/member-signups",
      async ({ analyticsService, adminToken, logger, set }) =>
        getMemberSignupsLogic({
          adminUid: getAdminUid(adminToken, logger),
          analyticsService,
          logger,
          set,
        }),
    )
    .get(
      "/cost-offset-rate",
      async ({ analyticsService, adminToken, logger, set }) =>
        getCostOffsetRateLogic({
          adminUid: getAdminUid(adminToken, logger),
          analyticsService,
          logger,
          set,
        }),
    )
    .get(
      "/match-request-locations",
      async ({ analyticsService, adminToken, logger, set }) =>
        getMatchRequestLocationsLogic({
          adminUid: getAdminUid(adminToken, logger),
          analyticsService,
          logger,
          set,
        }),
    )
    .get(
      "/top-pages",
      async ({ analyticsService, adminToken, logger, set }) =>
        getTopPagesLogic({
          adminUid: getAdminUid(adminToken, logger),
          analyticsService,
          logger,
          set,
        }),
    );
}
