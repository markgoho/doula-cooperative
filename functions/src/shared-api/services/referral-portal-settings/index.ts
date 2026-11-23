import { getReferralPortalSettings } from "./get-referral-portal-settings.js";
import type { ReferralPortalSettingsService as ReferralPortalSettingsServiceInterface } from "./interface.js";
import { updateReferralPortalSettings } from "./update-referral-portal-settings.js";

/**
 * Service for the Referral Portal v2 rollout gate (`settings/referralPortal`).
 * Each method lives in its own file to comply with the "one export per module" rule.
 */
export const ReferralPortalSettingsService: ReferralPortalSettingsServiceInterface =
  {
    getReferralPortalSettings,
    updateReferralPortalSettings,
  };
