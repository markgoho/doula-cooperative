import type { ReferralPortalSettingsDocument } from "../../../collections/settings.js";
import { timestampToIso } from "../../utils/timestamp-to-iso.js";
import type { ReferralPortalSettings } from "./interface.js";

/**
 * Convert the stored settings document (or its absence) to the API shape.
 * A missing document or missing `v2Enabled` means the gate is off.
 */
export function toReferralPortalSettings(
  document: Partial<ReferralPortalSettingsDocument> | undefined,
): ReferralPortalSettings {
  return {
    v2Enabled: document?.v2Enabled === true,
    ...(document?.updatedAt !== undefined && {
      updatedAt: timestampToIso(document.updatedAt),
    }),
    ...(document?.updatedBy !== undefined && {
      updatedBy: document.updatedBy,
    }),
  };
}
