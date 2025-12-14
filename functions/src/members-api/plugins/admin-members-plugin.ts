import { Elysia } from "elysia";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { AuthError, HttpError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  activateMembershipLogic,
  deactivateMembershipLogic,
  deleteUserLogic,
  extendMembershipLogic,
  listMembersLogic,
  updateMemberLogic,
} from "../routes/admin-members/index.js";
import {
  ActivateMembershipBodySchema,
  ExtendMembershipBodySchema,
  MemberIdParameterSchema,
  PaginationQuerySchema,
  UpdateMemberBodySchema,
} from "../schemas/member-schemas.js";
import { MemberAdminService } from "../services/admin-member/index.js";
import { AuthService } from "../services/auth/index.js";
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
 * Extract admin UID from token. Assumes onBeforeHandle guard validated the token.
 * @throws AuthError if adminToken is undefined
 */
function getAdminUid(
  adminToken: DecodedIdToken | undefined,
  logger: Logger,
): string {
  if (!adminToken) {
    logger.error("Admin token missing in route handler", {
      errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
      message: "This indicates a bug in the authentication guard",
    });
    throw new AuthError(
      "Authentication token missing. This is a server error, please try again.",
    );
  }
  return adminToken.uid;
}

/**
 * Create admin members plugin with centralized authentication guard.
 * All routes in this plugin require admin privileges.
 *
 * Routes are organized hierarchically:
 * - /admin/members           - List all members
 * - /admin/members/:memberId - Member-specific operations
 *   - /membership/*          - Membership management
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with admin routes
 */
export function createAdminMembersPlugin(services?: PartialServices) {
  return new Elysia({ name: "admin-members" })
    .decorate(
      SERVICE_KEYS.MEMBER_ADMIN_SERVICE,
      services?.memberAdminService ?? MemberAdminService,
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
    .onBeforeHandle(
      { as: "local" },
      ({ adminToken, authError, set }): { error: string } | undefined => {
        if (!adminToken && authError) {
          set.status = authError.statusCode;
          return { error: authError.message };
        }
        if (!adminToken) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        return undefined;
      },
    )
    .group("/admin/members", app =>
      app
        // GET /admin/members - List all members
        .get(
          "/",
          async ({ query, adminToken, memberAdminService, logger, set }) =>
            listMembersLogic({
              ...(query.limit !== undefined && { limit: query.limit }),
              ...(query.offset !== undefined && { offset: query.offset }),
              adminUid: getAdminUid(adminToken, logger),
              memberAdminService,
              logger,
              set,
            }),
          { query: PaginationQuerySchema },
        )
        // Member-specific routes under /:memberId
        .group("/:memberId", { params: MemberIdParameterSchema }, app =>
          app
            // PATCH /admin/members/:memberId - Update member
            .patch(
              "/",
              async ({
                params,
                body,
                adminToken,
                memberAdminService,
                logger,
                set,
              }) =>
                updateMemberLogic({
                  memberId: params.memberId,
                  updates: body,
                  adminUid: getAdminUid(adminToken, logger),
                  memberAdminService,
                  logger,
                  set,
                }),
              { body: UpdateMemberBodySchema },
            )
            // DELETE /admin/members/:memberId - Delete user
            .delete(
              "/",
              async ({ params, adminToken, memberAdminService, logger, set }) =>
                deleteUserLogic({
                  memberId: params.memberId,
                  adminUid: getAdminUid(adminToken, logger),
                  memberAdminService,
                  logger,
                  set,
                }),
            )
            // Membership management routes under /membership
            .group("/membership", app =>
              app
                // POST /admin/members/:memberId/membership/activate
                .post(
                  "/activate",
                  async ({
                    params,
                    body,
                    adminToken,
                    memberAdminService,
                    logger,
                    set,
                  }) =>
                    activateMembershipLogic({
                      memberId: params.memberId,
                      ...(body?.subscriptionStart !== undefined && {
                        subscriptionStart: body.subscriptionStart,
                      }),
                      ...(body?.membershipExpiresAt !== undefined && {
                        membershipExpiresAt: body.membershipExpiresAt,
                      }),
                      adminUid: getAdminUid(adminToken, logger),
                      memberAdminService,
                      logger,
                      set,
                    }),
                  { body: ActivateMembershipBodySchema },
                )
                // POST /admin/members/:memberId/membership/deactivate
                .post(
                  "/deactivate",
                  async ({
                    params,
                    adminToken,
                    memberAdminService,
                    logger,
                    set,
                  }) =>
                    deactivateMembershipLogic({
                      memberId: params.memberId,
                      adminUid: getAdminUid(adminToken, logger),
                      memberAdminService,
                      logger,
                      set,
                    }),
                )
                // POST /admin/members/:memberId/membership/extend
                .post(
                  "/extend",
                  async ({
                    params,
                    body,
                    adminToken,
                    memberAdminService,
                    logger,
                    set,
                  }) =>
                    extendMembershipLogic({
                      memberId: params.memberId,
                      newExpirationDate: body.newExpirationDate,
                      adminUid: getAdminUid(adminToken, logger),
                      memberAdminService,
                      logger,
                      set,
                    }),
                  { body: ExtendMembershipBodySchema },
                ),
            ),
        ),
    );
}
