import { ERROR_IDS } from "../../constants/error-ids.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ReferralPortalSettingsResponse } from "../schemas/referral-portal-settings-schemas.js";

export async function getReferralPortalSettingsLogic({
  adminUid,
  referralPortalSettingsService,
  logger,
  set,
}: {
  adminUid: string;
  referralPortalSettingsService: ReferralPortalSettingsService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ReferralPortalSettingsResponse | { error: string }> {
  try {
    const settings =
      await referralPortalSettingsService.getReferralPortalSettings();
    logger.info("Admin retrieved Referral Portal settings", { adminUid });
    return settings;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get Referral Portal settings",
      errorId: ERROR_IDS.API_ADMIN_GET_REFERRAL_PORTAL_SETTINGS_FAILED,
      logger,
      set,
    });
  }
}
