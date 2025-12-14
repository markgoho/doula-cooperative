import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { getMemberLogic } from "../routes/members.js";
import { MemberIdParameterSchema } from "../schemas/member-schemas.js";
import { AuthService } from "../services/auth/index.js";
import { MemberService } from "../services/member/member-service.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create members plugin for member-related routes.
 * These routes use owner-or-admin authorization which requires the resource ID,
 * so auth verification stays in the logic function rather than a plugin guard.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with member routes
 */
export function createMembersPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "members" })
      .decorate(
        SERVICE_KEYS.MEMBER_SERVICE,
        services?.memberService ?? MemberService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // GET /members/:memberId - Get member by ID (owner or admin)
      .get(
        "/members/:memberId",
        async ({ params, memberService, authService, logger, request, set }) =>
          getMemberLogic({
            memberId: params.memberId,
            memberService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
        },
      )
  );
}
