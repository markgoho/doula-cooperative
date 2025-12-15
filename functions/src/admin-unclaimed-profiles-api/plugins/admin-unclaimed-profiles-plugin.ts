import { Elysia } from "elysia";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import {
  getUnclaimedProfileLogic,
  listUnclaimedProfilesLogic,
} from "../routes/index.js";
import {
  EmailParameterSchema,
  ListUnclaimedProfilesQuerySchema,
} from "../schemas/unclaimed-profile-schemas.js";
import { UnclaimedProfileAdminService } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Auth result from derive - either a token or an error.
 * Index signature required for Elysia's derive return type.
 */
interface AuthResult {
  [key: string]: unknown;
  adminToken: DecodedIdToken | undefined;
  authError: HttpError | undefined;
}

/**
 * Create admin unclaimed profiles plugin with centralized authentication guard.
 * All routes in this plugin require admin privileges.
 *
 * Firebase rewrite: /api/admin/unclaimed-profiles/** → adminUnclaimedProfilesApi function
 * Plugin routes start from "/" - Firebase already provides /api/admin/unclaimed-profiles prefix
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with admin routes
 */
export function createAdminUnclaimedProfilesPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "admin-unclaimed-profiles" })
      .decorate(
        SERVICE_KEYS.UNCLAIMED_PROFILE_ADMIN_SERVICE,
        services?.unclaimedProfileAdminService ??
          UnclaimedProfileAdminService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      .derive(async ({ request, authService, logger }): Promise<AuthResult> => {
        const authorizationHeader =
          request.headers.get("authorization") ?? undefined;
        try {
          const token = await authService.verifyAdmin(authorizationHeader);
          return { adminToken: token, authError: undefined };
        } catch (error) {
          if (error instanceof HttpError) {
            return { adminToken: undefined, authError: error };
          }

          logger.error("Unexpected error during admin authentication", {
            errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
            error,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            errorType: error?.constructor?.name,
            hasAuthHeader: Boolean(authorizationHeader),
          });

          const infrastructureError = new HttpError(
            "Authentication service temporarily unavailable. Please try again.",
            503,
          );
          return {
            adminToken: undefined,
            authError: infrastructureError,
          };
        }
      })
      .onBeforeHandle({ as: "local" }, adminGuard)
      // GET / - List unclaimed profiles (served at /api/admin/unclaimed-profiles/)
      .get(
        "/",
        async ({
          query,
          adminToken,
          unclaimedProfileAdminService,
          logger,
          set,
        }) =>
          listUnclaimedProfilesLogic({
            ...(query.limit !== undefined && { limit: query.limit }),
            ...(query.offset !== undefined && { offset: query.offset }),
            adminUid: getAdminUid(adminToken, logger),
            unclaimedProfileAdminService,
            logger,
            set,
          }),
        { query: ListUnclaimedProfilesQuerySchema },
      )
      // GET /:email - Get unclaimed profile by email
      .get(
        "/:email",
        async ({
          params,
          adminToken,
          unclaimedProfileAdminService,
          logger,
          set,
        }) =>
          getUnclaimedProfileLogic({
            email: params.email,
            adminUid: getAdminUid(adminToken, logger),
            unclaimedProfileAdminService,
            logger,
            set,
          }),
        { params: EmailParameterSchema },
      )
  );
}
