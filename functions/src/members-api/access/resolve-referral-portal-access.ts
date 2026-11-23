import type { DecodedIdToken } from "firebase-admin/auth";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type {
  ReferralPortalSettings,
  ReferralPortalSettingsService,
} from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  isActiveStripeMember,
  type MemberDocument,
} from "../../types/member-document.js";
import { canPreviewReferralPortal } from "./can-preview-referral-portal.js";

export type ReferralPortalAccess =
  "allowed" | "portal_disabled" | "membership_required";

/**
 * Decide whether the authenticated requester can reach the Referral Portal.
 *
 * Order: preview roles (Admins) always pass; otherwise the Referral Portal v2
 * switch must be on, and the member must hold an active Stripe membership.
 *
 * @param loadMember - Loads the member document only when it is needed
 * @throws when the settings read or member load fails (settings failures are logged here)
 */
export async function resolveReferralPortalAccess({
  decodedToken,
  loadMember,
  referralPortalSettingsService,
  logger,
}: {
  decodedToken: DecodedIdToken;
  loadMember: () => Promise<MemberDocument>;
  referralPortalSettingsService: ReferralPortalSettingsService;
  logger: Logger;
}): Promise<ReferralPortalAccess> {
  if (canPreviewReferralPortal(decodedToken)) return "allowed";

  let settings: ReferralPortalSettings;
  try {
    settings = await referralPortalSettingsService.getReferralPortalSettings();
  } catch (error) {
    logger.error("Failed to read Referral Portal settings", {
      errorId: ERROR_IDS.API_MEMBER_REFERRAL_PORTAL_SETTINGS_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      uid: decodedToken.uid,
    });
    throw error;
  }

  if (!settings.v2Enabled) return "portal_disabled";

  const member = await loadMember();
  return isActiveStripeMember(member) ? "allowed" : "membership_required";
}
