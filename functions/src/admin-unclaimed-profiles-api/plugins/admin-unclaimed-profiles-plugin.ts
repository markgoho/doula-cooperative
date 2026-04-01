import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import { adminDerive } from "../../shared-api/utils/admin-derive.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import {
  deleteUnclaimedProfileLogic,
  draftUnclaimedProfileLogic,
  getUnclaimedProfileLogic,
  listUnclaimedProfilesLogic,
  refreshPaymentDatesLogic,
  updateEmailLogic,
} from "../routes/index.js";
import {
  ChangeEmailBodySchema,
  DeleteUnclaimedProfileResponseSchema,
  DraftUnclaimedProfileResponseSchema,
  EmailParameterSchema,
  ListUnclaimedProfilesQuerySchema,
  ListUnclaimedProfilesResponseSchema,
  RefreshPaymentDatesResponseSchema,
  UnclaimedProfileResponseSchema,
  UpdateEmailResponseSchema,
} from "../schemas/unclaimed-profile-schemas.js";
import { UnclaimedProfileAdminService } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

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
        services?.unclaimedProfileAdminService ?? UnclaimedProfileAdminService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(
        SERVICE_KEYS.EMAIL_SERVICE,
        services?.emailService ?? EmailService,
      )
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      .derive(adminDerive)
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
        {
          query: ListUnclaimedProfilesQuerySchema,
          response: ListUnclaimedProfilesResponseSchema,
        },
      )
      // POST /refresh-payment-dates - Bulk refresh stale payment dates
      .post(
        "/refresh-payment-dates",
        async ({ adminToken, unclaimedProfileAdminService, logger, set }) =>
          refreshPaymentDatesLogic({
            adminUid: getAdminUid(adminToken, logger),
            unclaimedProfileAdminService,
            logger,
            set,
          }),
        {
          response: RefreshPaymentDatesResponseSchema,
        },
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
        {
          params: EmailParameterSchema,
          response: UnclaimedProfileResponseSchema,
        },
      )
      // PATCH /:email - Update email
      .patch(
        "/:email",
        async ({
          params,
          body,
          adminToken,
          unclaimedProfileAdminService,
          logger,
          set,
        }) =>
          updateEmailLogic({
            oldEmail: params.email,
            newEmail: body.newEmail,
            adminUid: getAdminUid(adminToken, logger),
            unclaimedProfileAdminService,
            logger,
            set,
          }),
        {
          params: EmailParameterSchema,
          body: ChangeEmailBodySchema,
          response: UpdateEmailResponseSchema,
        },
      )
      // POST /:email/draft - Set linked public profile to draft without deleting legacy membership
      .post(
        "/:email/draft",
        async ({
          params,
          adminToken,
          unclaimedProfileAdminService,
          logger,
          set,
        }) =>
          draftUnclaimedProfileLogic({
            email: params.email,
            adminUid: getAdminUid(adminToken, logger),
            unclaimedProfileAdminService,
            logger,
            set,
          }),
        {
          params: EmailParameterSchema,
          response: DraftUnclaimedProfileResponseSchema,
        },
      )
      // DELETE /:email - Delete unclaimed profile
      .delete(
        "/:email",
        async ({
          params,
          adminToken,
          unclaimedProfileAdminService,
          emailService,
          logger,
          set,
        }) =>
          deleteUnclaimedProfileLogic({
            email: params.email,
            adminUid: getAdminUid(adminToken, logger),
            mailerliteApiKey: process.env["MAILERLITE_API_KEY"] ?? "",
            unclaimedProfileAdminService,
            emailService,
            logger,
            set,
          }),
        {
          params: EmailParameterSchema,
          response: DeleteUnclaimedProfileResponseSchema,
        },
      )
  );
}
