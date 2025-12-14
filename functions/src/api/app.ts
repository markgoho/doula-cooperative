import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { healthRoute } from "./routes/health.js";
import {
  listMembersLogic,
  updateMemberLogic,
  activateMembershipLogic,
  deactivateMembershipLogic,
  extendMembershipLogic,
  deleteUserLogic,
} from "./routes/admin-members/index.js";
import { getMemberLogic } from "./routes/members.js";
import {
  MemberIdParameterSchema,
  PaginationQuerySchema,
  UpdateMemberBodySchema,
  ActivateMembershipBodySchema,
  ExtendMembershipBodySchema,
} from "./schemas/member-schemas.js";
import { AuthService } from "./services/auth-service/index.js";
import { MemberAdminService } from "./services/member-admin-service/index.js";
import { MemberService } from "./services/member-service.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create Elysia app with injectable dependencies.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  // No Elysia prefix needed - Firebase function named "api" already routes requests to /api/*
  return (
    new Elysia({ adapter: node() })
      // Register services for dependency injection into route handlers
      .decorate(
        SERVICE_KEYS.MEMBER_SERVICE,
        services?.memberService ?? MemberService,
      )
      .decorate(
        SERVICE_KEYS.MEMBER_ADMIN_SERVICE,
        services?.memberAdminService ?? MemberAdminService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Health check route
      .get("/health", () => healthRoute())
      // Member routes
      .get(
        "/members/:memberId",
        async ({ params, memberService, authService, logger, request, set }) =>
          getMemberLogic({
            memberId: params.memberId,
            memberService,
            authService,
            logger,
            authorizationHeader: request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
        },
      )
      // Admin member management routes
      .get(
        "/admin/members",
        async ({ query, memberAdminService, authService, logger, request, set }) =>
          listMembersLogic({
            ...(query.limit !== undefined && { limit: query.limit }),
            ...(query.offset !== undefined && { offset: query.offset }),
            memberAdminService,
            authService,
            logger,
            authorizationHeader: request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          query: PaginationQuerySchema,
        },
      )
      .patch(
        "/admin/members/:memberId",
        async ({ params, body, memberAdminService, authService, logger, request, set }) =>
          updateMemberLogic({
            memberId: params.memberId,
            updates: body,
            memberAdminService,
            authService,
            logger,
            authorizationHeader: request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          body: UpdateMemberBodySchema,
        },
      )
      .post(
        "/admin/members/:memberId/membership/activate",
        async ({ params, body, memberAdminService, authService, logger, request, set }) =>
          activateMembershipLogic({
            memberId: params.memberId,
            ...(body?.subscriptionStart !== undefined && {
              subscriptionStart: body.subscriptionStart,
            }),
            ...(body?.membershipExpiresAt !== undefined && {
              membershipExpiresAt: body.membershipExpiresAt,
            }),
            memberAdminService,
            authService,
            logger,
            authorizationHeader: request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          body: ActivateMembershipBodySchema,
        },
      )
      .post(
        "/admin/members/:memberId/membership/deactivate",
        async ({ params, memberAdminService, authService, logger, request, set }) =>
          deactivateMembershipLogic({
            memberId: params.memberId,
            memberAdminService,
            authService,
            logger,
            authorizationHeader: request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
        },
      )
      .post(
        "/admin/members/:memberId/membership/extend",
        async ({ params, body, memberAdminService, authService, logger, request, set }) =>
          extendMembershipLogic({
            memberId: params.memberId,
            newExpirationDate: body.newExpirationDate,
            memberAdminService,
            authService,
            logger,
            authorizationHeader: request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          body: ExtendMembershipBodySchema,
        },
      )
      .delete(
        "/admin/members/:memberId",
        async ({ params, memberAdminService, authService, logger, request, set }) =>
          deleteUserLogic({
            memberId: params.memberId,
            memberAdminService,
            authService,
            logger,
            authorizationHeader: request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
        },
      )
  );
}

// Export default app instance with real services for production
export const app = createApp();
