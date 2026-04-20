import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import { MemberFirestoreService } from "../../shared-api/services/member-firestore/index.js";
import { cancelMembershipLogic } from "../routes/cancel-membership.js";
import { getMemberLogic } from "../routes/members.js";
import { syncEmailLogic } from "../routes/sync-email.js";
import { updateMemberNameLogic } from "../routes/update-member-name.js";
import { updateNewsletterPreferenceLogic } from "../routes/update-newsletter-preference.js";
import { verifyEmailLogic } from "../routes/verify-email.js";
import {
  CancelMembershipResponseSchema,
  GetMemberResponseSchema,
  MemberIdParameterSchema,
  UpdateMemberNameBodySchema,
  UpdateMemberNameResponseSchema,
  UpdateNewsletterPreferenceBodySchema,
  UpdateNewsletterPreferenceResponseSchema,
  VerifyEmailResponseSchema,
} from "../schemas/member-schemas.js";
import { MemberService } from "../services/member/member-service.js";
import { NewsletterService } from "../services/newsletter/newsletter-service.js";
import { VerifyEmailServiceImpl } from "../services/verify-email/verify-email-service.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create members plugin for member-related routes.
 * These routes use owner-or-admin authorization which requires the resource ID,
 * so auth verification stays in the logic function rather than a plugin guard.
 *
 * Firebase rewrite: /api/members/** → membersApi function
 * Plugin routes start from "/" - Firebase already provides /api/members prefix
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
      .decorate(
        SERVICE_KEYS.EMAIL_SERVICE,
        services?.emailService ?? EmailService,
      )
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      .decorate(
        SERVICE_KEYS.NEWSLETTER_SERVICE,
        services?.newsletterService ?? NewsletterService,
      )
      .decorate(
        SERVICE_KEYS.VERIFY_EMAIL_SERVICE,
        services?.verifyEmailService ?? VerifyEmailServiceImpl,
      )
      .decorate(
        SERVICE_KEYS.MEMBER_FIRESTORE_SERVICE,
        services?.memberFirestoreService ?? MemberFirestoreService,
      )
      // GET /:memberId - Get member by ID (owner or admin) - Served at /api/members/:memberId
      .get(
        "/:memberId",
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
          response: GetMemberResponseSchema,
        },
      )
      // PATCH /:memberId/newsletter-preference - Update newsletter preference (owner or admin) - Served at /api/members/:memberId/newsletter-preference
      .patch(
        "/:memberId/newsletter-preference",
        async ({
          params,
          body,
          newsletterService,
          authService,
          emailService,
          logger,
          request,
          set,
        }) =>
          updateNewsletterPreferenceLogic({
            memberId: params.memberId,
            subscribed: body.subscribed,
            newsletterService,
            authService,
            emailService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          body: UpdateNewsletterPreferenceBodySchema,
          response: UpdateNewsletterPreferenceResponseSchema,
        },
      )
      // POST /:memberId/verify-email - Mark email as verified (owner only) - Served at /api/members/:memberId/verify-email
      .post(
        "/:memberId/verify-email",
        async ({
          params,
          verifyEmailService,
          authService,
          logger,
          request,
          set,
        }) =>
          verifyEmailLogic({
            memberId: params.memberId,
            authService,
            verifyEmailService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          response: VerifyEmailResponseSchema,
        },
      )
      // POST /:memberId/sync-email - Sync auth email to member doc (owner only) - Served at /api/members/:memberId/sync-email
      .post(
        "/:memberId/sync-email",
        async ({
          params,
          authService,
          memberFirestoreService,
          emailService,
          logger,
          request,
          set,
        }) =>
          syncEmailLogic({
            memberId: params.memberId,
            authService,
            memberFirestoreService,
            emailService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
        },
      )
      // PATCH /:memberId/name - Update member name (owner or admin) - Served at /api/members/:memberId/name
      .patch(
        "/:memberId/name",
        async ({
          params,
          body,
          memberService,
          authService,
          logger,
          request,
          set,
        }) =>
          updateMemberNameLogic({
            memberId: params.memberId,
            name: body.name,
            memberService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          body: UpdateMemberNameBodySchema,
          response: UpdateMemberNameResponseSchema,
        },
      )
      // POST /:memberId/membership/cancel - Cancel membership (owner or admin) - Served at /api/members/:memberId/membership/cancel
      .post(
        "/:memberId/membership/cancel",
        async ({ params, memberService, authService, logger, request, set }) =>
          cancelMembershipLogic({
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
          response: CancelMembershipResponseSchema,
        },
      )
  );
}
