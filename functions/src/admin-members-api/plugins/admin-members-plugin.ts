import { Elysia } from "elysia";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { AuthError, HttpError } from "../../shared-api/errors/http-error.js";
import { AuthService } from "../../shared-api/services/auth/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  activateMembershipLogic,
  deactivateMembershipLogic,
  deleteUserLogic,
  extendMembershipLogic,
  getMemberLogic,
  listMembersLogic,
  updateMemberLogic,
} from "../routes/index.js";
import {
  ActivateMembershipBodySchema,
  ExtendMembershipBodySchema,
  MemberIdParameterSchema,
  UpdateMemberBodySchema,
} from "../schemas/member-schemas.js";
import { MemberAdminService } from "../services/index.js";
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
 * Firebase rewrite: /api/admin/members/** → adminMembersApi function
 * Plugin routes start from "/" - Firebase already provides /api/admin/members prefix
 *
 * Routes are organized hierarchically:
 * - /                  - List all members (served at /api/admin/members/)
 * - /:memberId         - Member-specific operations (served at /api/admin/members/:memberId)
 *   - /membership/*    - Membership management
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with admin routes
 */
export function createAdminMembersPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "admin-members" })
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
      // GET / - List all members (served at /api/admin/members/)
      .get("/", async ({ adminToken, memberAdminService, logger, set }) =>
        listMembersLogic({
          adminUid: getAdminUid(adminToken, logger),
          memberAdminService,
          logger,
          set,
        }),
      )
      // Member-specific routes under /:memberId (served at /api/admin/members/:memberId)
      .group("/:memberId", { params: MemberIdParameterSchema }, app =>
        app
          // GET /:memberId - Get single member (served at /api/admin/members/:memberId)
          .get(
            "/",
            async ({ params, adminToken, memberAdminService, logger, set }) =>
              getMemberLogic({
                memberId: params.memberId,
                adminUid: getAdminUid(adminToken, logger),
                memberAdminService,
                logger,
                set,
              }),
          )
          // PATCH /:memberId - Update member (served at /api/admin/members/:memberId)
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
          // DELETE /:memberId - Delete user (served at /api/admin/members/:memberId)
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
          // Membership management routes under /:memberId/membership
          .group("/membership", app =>
            app
              // POST /:memberId/membership/activate (served at /api/admin/members/:memberId/membership/activate)
              .post(
                "/activate",
                async ({
                  params,
                  body,
                  adminToken,
                  memberAdminService,
                  logger,
                  set,
                }) => {
                  const typedBody = body as
                    | {
                        subscriptionStart?: string;
                        membershipExpiresAt?: string;
                      }
                    | undefined;
                  return activateMembershipLogic({
                    memberId: params.memberId,
                    ...(typedBody?.subscriptionStart !== undefined && {
                      subscriptionStart: typedBody.subscriptionStart,
                    }),
                    ...(typedBody?.membershipExpiresAt !== undefined && {
                      membershipExpiresAt: typedBody.membershipExpiresAt,
                    }),
                    adminUid: getAdminUid(adminToken, logger),
                    memberAdminService,
                    logger,
                    set,
                  });
                },
                { body: ActivateMembershipBodySchema },
              )
              // POST /:memberId/membership/deactivate (served at /api/admin/members/:memberId/membership/deactivate)
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
              // POST /:memberId/membership/extend (served at /api/admin/members/:memberId/membership/extend)
              .post(
                "/extend",
                async ({
                  params,
                  body,
                  adminToken,
                  memberAdminService,
                  logger,
                  set,
                }) => {
                  const typedBody = body as { newExpirationDate: string };
                  return extendMembershipLogic({
                    memberId: params.memberId,
                    newExpirationDate: typedBody.newExpirationDate,
                    adminUid: getAdminUid(adminToken, logger),
                    memberAdminService,
                    logger,
                    set,
                  });
                },
                { body: ExtendMembershipBodySchema },
              ),
          ),
      )
  );
}
