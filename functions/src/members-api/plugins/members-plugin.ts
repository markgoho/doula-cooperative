import { Elysia, t } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import { MemberFirestoreService } from "../../shared-api/services/member-firestore/index.js";
import { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/index.js";
import { cancelMembershipLogic } from "../routes/cancel-membership.js";
import { deleteOfflineResponseLogic } from "../routes/delete-offline-response.js";
import { getReferralLogic } from "../routes/get-referral.js";
import { listReferralDoulasLogic } from "../routes/list-referral-doulas.js";
import { listReferralsLogic } from "../routes/list-referrals.js";
import { getMemberLogic } from "../routes/members.js";
import { recordLegacyOutcomeLogic } from "../routes/record-legacy-outcome.js";
import { recordOfflineResponseLogic } from "../routes/record-offline-response.js";
import { recordReferralOutcomeLogic } from "../routes/record-referral-outcome.js";
import { sendOutreachLogic } from "../routes/send-outreach.js";
import { syncEmailLogic } from "../routes/sync-email.js";
import { updateMemberNameLogic } from "../routes/update-member-name.js";
import { updateNewsletterPreferenceLogic } from "../routes/update-newsletter-preference.js";
import { updateReferralNotificationsLogic } from "../routes/update-referral-notifications.js";
import { verifyEmailLogic } from "../routes/verify-email.js";
import {
  CancelMembershipResponseSchema,
  GetMemberResponseSchema,
  MemberIdParameterSchema,
  UpdateMemberNameBodySchema,
  UpdateMemberNameResponseSchema,
  UpdateNewsletterPreferenceBodySchema,
  UpdateNewsletterPreferenceResponseSchema,
  UpdateReferralNotificationsBodySchema,
  UpdateReferralNotificationsResponseSchema,
  VerifyEmailResponseSchema,
} from "../schemas/member-schemas.js";
import {
  DeleteOfflineResponseRouteResponseSchema,
  LegacyOutcomeParameterSchema,
  ListReferralDoulasRouteResponseSchema,
  ListReferralsRouteResponseSchema,
  OfflineResponseParameterSchema,
  RecordOfflineResponseBodySchema,
  RecordOfflineResponseRouteResponseSchema,
  ReferralDetailRouteResponseSchema,
  ReferralOutcomeRouteResponseSchema,
  ReferralRequestIdParameterSchema,
  SendOutreachBodySchema,
  SendOutreachRouteResponseSchema,
  SetReferralOutcomeBodySchema,
} from "../schemas/referral-schemas.js";
import { MemberService } from "../services/member/member-service.js";
import { NewsletterService } from "../services/newsletter/newsletter-service.js";
import { OfflineResponseServiceImpl } from "../services/offline-response/offline-response-service.js";
import { OutreachServiceImpl } from "../services/outreach/outreach-service.js";
import { ReferralOutcomeServiceImpl } from "../services/referral-outcome/referral-outcome-service.js";
import { ReferralsServiceImpl } from "../services/referrals/referrals-service.js";
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
      .decorate(
        SERVICE_KEYS.REFERRALS_SERVICE,
        services?.referralsService ?? ReferralsServiceImpl,
      )
      .decorate(
        SERVICE_KEYS.REFERRAL_PORTAL_SETTINGS_SERVICE,
        services?.referralPortalSettingsService ??
          ReferralPortalSettingsService,
      )
      .decorate(
        SERVICE_KEYS.OUTREACH_SERVICE,
        services?.outreachService ?? OutreachServiceImpl,
      )
      .decorate(
        SERVICE_KEYS.REFERRAL_OUTCOME_SERVICE,
        services?.referralOutcomeService ?? ReferralOutcomeServiceImpl,
      )
      .decorate(
        SERVICE_KEYS.OFFLINE_RESPONSE_SERVICE,
        services?.offlineResponseService ?? OfflineResponseServiceImpl,
      )
      // GET /:memberId - Get member by ID (owner or admin) - Served at /api/members/:memberId
      .get(
        "/:memberId",
        async ({
          params,
          memberService,
          authService,
          referralPortalSettingsService,
          logger,
          request,
          set,
        }) =>
          getMemberLogic({
            memberId: params.memberId,
            memberService,
            authService,
            referralPortalSettingsService,
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
      // PATCH /:memberId/referral-notifications - Turn Referral Notifications on/off (owner only) - Served at /api/members/:memberId/referral-notifications
      .patch(
        "/:memberId/referral-notifications",
        async ({
          params,
          body,
          memberService,
          authService,
          logger,
          request,
          set,
        }) =>
          updateReferralNotificationsLogic({
            memberId: params.memberId,
            enabled: body.enabled,
            memberService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          body: UpdateReferralNotificationsBodySchema,
          response: UpdateReferralNotificationsResponseSchema,
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
      // GET /:memberId/referrals - List referrals (active Stripe member or admin) - Served at /api/members/:memberId/referrals
      .get(
        "/:memberId/referrals",
        async ({
          params,
          memberService,
          referralsService,
          referralPortalSettingsService,
          authService,
          logger,
          request,
          set,
        }) =>
          listReferralsLogic({
            memberId: params.memberId,
            memberService,
            referralsService,
            referralPortalSettingsService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          response: ListReferralsRouteResponseSchema,
        },
      )
      // GET /:memberId/referrals/:requestId - Get referral detail (active Stripe member or admin) - Served at /api/members/:memberId/referrals/:requestId
      .get(
        "/:memberId/referrals/:requestId",
        async ({
          params,
          memberService,
          referralsService,
          referralPortalSettingsService,
          outreachService,
          authService,
          logger,
          request,
          set,
        }) =>
          getReferralLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            memberService,
            referralsService,
            referralPortalSettingsService,
            outreachService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: t.Object({
            memberId: MemberIdParameterSchema.properties.memberId,
            requestId: ReferralRequestIdParameterSchema.properties.requestId,
          }),
          response: ReferralDetailRouteResponseSchema,
        },
      )
      // POST /:memberId/referrals/:requestId/outreach - Send this Member's one Outreach (owner only) - Served at /api/members/:memberId/referrals/:requestId/outreach
      .post(
        "/:memberId/referrals/:requestId/outreach",
        async ({
          params,
          body,
          memberService,
          referralsService,
          referralPortalSettingsService,
          outreachService,
          authService,
          emailService,
          logger,
          request,
          set,
        }) =>
          sendOutreachLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            message: body.message,
            memberService,
            referralsService,
            referralPortalSettingsService,
            outreachService,
            authService,
            emailService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: t.Object({
            memberId: MemberIdParameterSchema.properties.memberId,
            requestId: ReferralRequestIdParameterSchema.properties.requestId,
          }),
          body: SendOutreachBodySchema,
          response: SendOutreachRouteResponseSchema,
        },
      )
      // PUT /:memberId/referrals/:requestId/outcome - Set or change your Referral Outcome (owner only, after Outreach) - Served at /api/members/:memberId/referrals/:requestId/outcome
      .put(
        "/:memberId/referrals/:requestId/outcome",
        async ({
          params,
          body,
          memberService,
          referralsService,
          referralPortalSettingsService,
          referralOutcomeService,
          authService,
          logger,
          request,
          set,
        }) =>
          recordReferralOutcomeLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            outcome: body.outcome,
            memberService,
            referralsService,
            referralPortalSettingsService,
            referralOutcomeService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: t.Object({
            memberId: MemberIdParameterSchema.properties.memberId,
            requestId: ReferralRequestIdParameterSchema.properties.requestId,
          }),
          body: SetReferralOutcomeBodySchema,
          response: ReferralOutcomeRouteResponseSchema,
        },
      )
      // DELETE /:memberId/referrals/:requestId/outcome - Clear your Referral Outcome (owner only, after Outreach) - Served at /api/members/:memberId/referrals/:requestId/outcome
      .delete(
        "/:memberId/referrals/:requestId/outcome",
        async ({
          params,
          memberService,
          referralsService,
          referralPortalSettingsService,
          referralOutcomeService,
          authService,
          logger,
          request,
          set,
        }) =>
          recordReferralOutcomeLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            outcome: undefined,
            memberService,
            referralsService,
            referralPortalSettingsService,
            referralOutcomeService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: t.Object({
            memberId: MemberIdParameterSchema.properties.memberId,
            requestId: ReferralRequestIdParameterSchema.properties.requestId,
          }),
          response: ReferralOutcomeRouteResponseSchema,
        },
      )
      // GET /:memberId/referral-doulas - Doulas to name in an Offline Response (Referral Coordinator only) - Served at /api/members/:memberId/referral-doulas
      .get(
        "/:memberId/referral-doulas",
        async ({
          params,
          offlineResponseService,
          authService,
          logger,
          request,
          set,
        }) =>
          listReferralDoulasLogic({
            memberId: params.memberId,
            offlineResponseService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: MemberIdParameterSchema,
          response: ListReferralDoulasRouteResponseSchema,
        },
      )
      // POST /:memberId/referrals/:requestId/offline-responses - Record an Offline Response (Referral Coordinator only) - Served at /api/members/:memberId/referrals/:requestId/offline-responses
      .post(
        "/:memberId/referrals/:requestId/offline-responses",
        async ({
          params,
          body,
          memberService,
          referralsService,
          offlineResponseService,
          authService,
          logger,
          request,
          set,
        }) =>
          recordOfflineResponseLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            kind: body.kind,
            id: body.id,
            memberService,
            referralsService,
            offlineResponseService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: t.Object({
            memberId: MemberIdParameterSchema.properties.memberId,
            requestId: ReferralRequestIdParameterSchema.properties.requestId,
          }),
          body: RecordOfflineResponseBodySchema,
          response: RecordOfflineResponseRouteResponseSchema,
        },
      )
      // DELETE /:memberId/referrals/:requestId/offline-responses/:kind/:id - Delete an Offline Response (its recorder, or a Coordinator who is an Admin) - Served at /api/members/:memberId/referrals/:requestId/offline-responses/:kind/:id
      .delete(
        "/:memberId/referrals/:requestId/offline-responses/:kind/:id",
        async ({
          params,
          referralsService,
          offlineResponseService,
          authService,
          logger,
          request,
          set,
        }) =>
          deleteOfflineResponseLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            kind: params.kind,
            id: params.id,
            referralsService,
            offlineResponseService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: OfflineResponseParameterSchema,
          response: DeleteOfflineResponseRouteResponseSchema,
        },
      )
      // PUT /:memberId/referrals/:requestId/offline-responses/legacy/:id/outcome - Set a not-yet-migrated doula's Referral Outcome (Referral Coordinator only) - Served at /api/members/:memberId/referrals/:requestId/offline-responses/legacy/:id/outcome
      .put(
        "/:memberId/referrals/:requestId/offline-responses/legacy/:id/outcome",
        async ({
          params,
          body,
          referralsService,
          offlineResponseService,
          authService,
          logger,
          request,
          set,
        }) =>
          recordLegacyOutcomeLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            id: params.id,
            outcome: body.outcome,
            referralsService,
            offlineResponseService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: LegacyOutcomeParameterSchema,
          body: SetReferralOutcomeBodySchema,
          response: ReferralOutcomeRouteResponseSchema,
        },
      )
      // DELETE /:memberId/referrals/:requestId/offline-responses/legacy/:id/outcome - Clear a not-yet-migrated doula's Referral Outcome (Referral Coordinator only) - Served at /api/members/:memberId/referrals/:requestId/offline-responses/legacy/:id/outcome
      .delete(
        "/:memberId/referrals/:requestId/offline-responses/legacy/:id/outcome",
        async ({
          params,
          referralsService,
          offlineResponseService,
          authService,
          logger,
          request,
          set,
        }) =>
          recordLegacyOutcomeLogic({
            memberId: params.memberId,
            requestId: params.requestId,
            id: params.id,
            outcome: undefined,
            referralsService,
            offlineResponseService,
            authService,
            logger,
            authorizationHeader:
              request.headers.get("authorization") ?? undefined,
            set,
          }),
        {
          params: LegacyOutcomeParameterSchema,
          response: ReferralOutcomeRouteResponseSchema,
        },
      )
  );
}
