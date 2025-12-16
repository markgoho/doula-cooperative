import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { adminDerive } from "../../shared-api/utils/admin-derive.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import {
  getMatchRequestLogic,
  listMatchRequestsLogic,
  updateMatchRequestLogic,
} from "../routes/index.js";
import {
  ListMatchRequestsQuerySchema,
  RequestIdParameterSchema,
  UpdateMatchRequestBodySchema,
} from "../schemas/match-request-schemas.js";
import { MatchRequestAdminService } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create admin match requests plugin with centralized authentication guard.
 * All routes in this plugin require admin privileges.
 *
 * Firebase rewrite: /api/admin/match-requests/** → adminMatchRequestsApi function
 * Plugin routes start from "/" - Firebase already provides /api/admin/match-requests prefix
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with admin routes
 */
export function createAdminMatchRequestsPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "admin-match-requests" })
      .decorate(
        SERVICE_KEYS.MATCH_REQUEST_ADMIN_SERVICE,
        services?.matchRequestAdminService ?? MatchRequestAdminService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      .derive(adminDerive)
      .onBeforeHandle({ as: "local" }, adminGuard)
      // GET / - List match requests (served at /api/admin/match-requests/)
      .get(
        "/",
        async ({ query, adminToken, matchRequestAdminService, logger, set }) =>
          listMatchRequestsLogic({
            ...(query.limit !== undefined && { limit: query.limit }),
            ...(query.offset !== undefined && { offset: query.offset }),
            ...(query.status !== undefined && { status: query.status }),
            adminUid: getAdminUid(adminToken, logger),
            matchRequestAdminService,
            logger,
            set,
          }),
        { query: ListMatchRequestsQuerySchema },
      )
      // Request-specific routes under /:requestId
      .group("/:requestId", { params: RequestIdParameterSchema }, app =>
        app
          // GET /:requestId - Get single match request
          .get(
            "/",
            async ({
              params,
              adminToken,
              matchRequestAdminService,
              logger,
              set,
            }) =>
              getMatchRequestLogic({
                requestId: params.requestId,
                adminUid: getAdminUid(adminToken, logger),
                matchRequestAdminService,
                logger,
                set,
              }),
          )
          // PATCH /:requestId - Update match request status
          .patch(
            "/",
            async ({
              params,
              body,
              adminToken,
              matchRequestAdminService,
              logger,
              set,
            }) => {
              const typedBody = body as { sent: boolean };
              return updateMatchRequestLogic({
                requestId: params.requestId,
                sent: typedBody.sent,
                adminUid: getAdminUid(adminToken, logger),
                matchRequestAdminService,
                logger,
                set,
              });
            },
            { body: UpdateMatchRequestBodySchema },
          ),
      )
  );
}
