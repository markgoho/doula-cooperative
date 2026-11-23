import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/index.js";
import { adminDerive } from "../../shared-api/utils/admin-derive.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import { getReferralPortalSettingsLogic } from "../routes/get-referral-portal-settings.js";
import { updateReferralPortalSettingsLogic } from "../routes/update-referral-portal-settings.js";
import { UpdateReferralPortalSettingsBodySchema } from "../schemas/referral-portal-settings-schemas.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create admin settings plugin with centralized authentication guard.
 * All routes in this plugin require admin privileges.
 *
 * Firebase rewrite: /api/admin/settings/** → adminSettingsApi function
 * Plugin routes start from "/" - the app adds the /api/admin/settings prefix
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with admin settings routes
 */
export function createAdminSettingsPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "admin-settings" })
      .decorate(
        SERVICE_KEYS.REFERRAL_PORTAL_SETTINGS_SERVICE,
        services?.referralPortalSettingsService ??
          ReferralPortalSettingsService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      .derive(adminDerive)
      .onBeforeHandle({ as: "local" }, adminGuard)
      // GET /referral-portal - Read the Referral Portal v2 switch
      .get(
        "/referral-portal",
        async ({ adminToken, referralPortalSettingsService, logger, set }) =>
          getReferralPortalSettingsLogic({
            adminUid: getAdminUid(adminToken, logger),
            referralPortalSettingsService,
            logger,
            set,
          }),
      )
      // PATCH /referral-portal - Flip the Referral Portal v2 switch
      .patch(
        "/referral-portal",
        async ({
          body,
          adminToken,
          referralPortalSettingsService,
          logger,
          set,
        }) =>
          updateReferralPortalSettingsLogic({
            v2Enabled: body.v2Enabled,
            adminUid: getAdminUid(adminToken, logger),
            referralPortalSettingsService,
            logger,
            set,
          }),
        { body: UpdateReferralPortalSettingsBodySchema },
      )
  );
}
