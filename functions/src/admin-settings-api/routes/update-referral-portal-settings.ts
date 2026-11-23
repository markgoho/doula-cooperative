import { ERROR_IDS } from "../../constants/error-ids.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ReferralPortalSettingsResponse } from "../schemas/referral-portal-settings-schemas.js";

export async function updateReferralPortalSettingsLogic({
  v2Enabled,
  adminUid,
  referralPortalSettingsService,
  logger,
  set,
}: {
  v2Enabled: boolean;
  adminUid: string;
  referralPortalSettingsService: ReferralPortalSettingsService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ReferralPortalSettingsResponse | { error: string }> {
  try {
    const settings =
      await referralPortalSettingsService.updateReferralPortalSettings({
        v2Enabled,
        updatedBy: adminUid,
      });
    logger.info("Admin updated Referral Portal v2 switch", {
      adminUid,
      v2Enabled,
    });
    return settings;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "update Referral Portal settings",
      errorId: ERROR_IDS.API_ADMIN_UPDATE_REFERRAL_PORTAL_SETTINGS_FAILED,
      logger,
      set,
      context: { adminUid, v2Enabled },
    });
  }
}
