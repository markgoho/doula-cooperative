import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import { adminDerive } from "../../shared-api/utils/admin-derive.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import {
  changeEmailAndResendLogic,
  deleteUnclaimedProfileLogic,
  getUnclaimedProfileLogic,
  listUnclaimedProfilesLogic,
  sendInvitationLogic,
} from "../routes/index.js";
import {
  ChangeEmailAndResendResponseSchema,
  ChangeEmailBodySchema,
  DeleteUnclaimedProfileResponseSchema,
  EmailParameterSchema,
  ListUnclaimedProfilesQuerySchema,
  ListUnclaimedProfilesResponseSchema,
  SendInvitationResponseSchema,
  UnclaimedProfileResponseSchema,
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
      // POST /:email/invitation - Send invitation email to unclaimed profile
      .post(
        "/:email/invitation",
        async ({
          params,
          adminToken,
          unclaimedProfileAdminService,
          emailService,
          logger,
          set,
        }) =>
          sendInvitationLogic({
            email: params.email,
            adminUid: getAdminUid(adminToken, logger),
            unclaimedProfileAdminService,
            emailService,
            logger,
            set,
          }),
        {
          params: EmailParameterSchema,
          response: SendInvitationResponseSchema,
        },
      )
      // POST /:email/change-email - Change email and resend invitation
      .post(
        "/:email/change-email",
        async ({
          params,
          body,
          adminToken,
          unclaimedProfileAdminService,
          emailService,
          logger,
          set,
        }) =>
          changeEmailAndResendLogic({
            oldEmail: params.email,
            newEmail: body.newEmail,
            adminUid: getAdminUid(adminToken, logger),
            unclaimedProfileAdminService,
            emailService,
            logger,
            set,
          }),
        {
          params: EmailParameterSchema,
          body: ChangeEmailBodySchema,
          response: ChangeEmailAndResendResponseSchema,
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
