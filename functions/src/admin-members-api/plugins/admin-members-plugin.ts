import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import { adminDerive } from "../../shared-api/utils/admin-derive.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import {
  activateMembershipLogic,
  deactivateMembershipLogic,
  deleteUserLogic,
  extendMembershipLogic,
  getMemberLogic,
  listMembersLogic,
  refundMembershipLogic,
  updateClaimsLogic,
  updateMemberLogic,
} from "../routes/index.js";
import {
  ActivateMembershipApiResponseSchema,
  ActivateMembershipBodySchema,
  DeactivateMembershipApiResponseSchema,
  DeleteUserApiResponseSchema,
  ExtendMembershipApiResponseSchema,
  ExtendMembershipBodySchema,
  GetMemberApiResponseSchema,
  ListMembersApiResponseSchema,
  MemberIdParameterSchema,
  RefundMembershipApiResponseSchema,
  RefundMembershipBodySchema,
  UpdateClaimsApiResponseSchema,
  UpdateClaimsBodySchema,
  UpdateMemberApiResponseSchema,
  UpdateMemberBodySchema,
} from "../schemas/member-schemas.js";
import { MemberAdminService } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

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
      .decorate(
        SERVICE_KEYS.EMAIL_SERVICE,
        services?.emailService ?? EmailService,
      )
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      .derive(adminDerive)
      .onBeforeHandle({ as: "local" }, adminGuard)
      // GET / - List all members (served at /api/admin/members/)
      .get(
        "/",
        async ({ adminToken, memberAdminService, logger, set }) =>
          listMembersLogic({
            adminUid: getAdminUid(adminToken, logger),
            memberAdminService,
            logger,
            set,
          }),
        {
          response: ListMembersApiResponseSchema,
        },
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
            {
              response: GetMemberApiResponseSchema,
            },
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
            {
              body: UpdateMemberBodySchema,
              response: UpdateMemberApiResponseSchema,
            },
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
            {
              response: DeleteUserApiResponseSchema,
            },
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
                {
                  body: ActivateMembershipBodySchema,
                  response: ActivateMembershipApiResponseSchema,
                },
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
                {
                  response: DeactivateMembershipApiResponseSchema,
                },
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
                {
                  body: ExtendMembershipBodySchema,
                  response: ExtendMembershipApiResponseSchema,
                },
              )
              // POST /:memberId/membership/refund (served at /api/admin/members/:memberId/membership/refund)
              .post(
                "/refund",
                async ({
                  params,
                  body,
                  adminToken,
                  memberAdminService,
                  emailService,
                  logger,
                  set,
                }) => {
                  const typedBody = body as { reason?: string } | undefined;
                  return refundMembershipLogic({
                    memberId: params.memberId,
                    ...(typedBody?.reason !== undefined && {
                      reason: typedBody.reason,
                    }),
                    adminUid: getAdminUid(adminToken, logger),
                    memberAdminService,
                    emailService,
                    logger,
                    set,
                  });
                },
                {
                  body: RefundMembershipBodySchema,
                  response: RefundMembershipApiResponseSchema,
                },
              ),
          )
          // PATCH /:memberId/claims - Update custom claims (served at /api/admin/members/:memberId/claims)
          .patch(
            "/claims",
            async ({
              params,
              body,
              adminToken,
              memberAdminService,
              logger,
              set,
            }) => {
              const typedBody = body as { admin?: boolean };
              return updateClaimsLogic({
                uid: params.memberId,
                claims: typedBody,
                adminUid: getAdminUid(adminToken, logger),
                memberAdminService,
                logger,
                set,
              });
            },
            {
              body: UpdateClaimsBodySchema,
              response: UpdateClaimsApiResponseSchema,
            },
          ),
      )
  );
}
