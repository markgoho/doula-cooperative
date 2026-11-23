import type { ReferralPortalAccess } from "./resolve-referral-portal-access.js";

/**
 * 403 bodies for each denied Referral Portal access outcome.
 * `code` lets the members app tell "not available yet" apart from a lapsed membership.
 */
export const REFERRAL_PORTAL_DENIAL: Record<
  Exclude<ReferralPortalAccess, "allowed">,
  { error: string; code: string }
> = {
  portal_disabled: {
    error: "The referral portal is not available yet",
    code: "REFERRAL_PORTAL_DISABLED",
  },
  membership_required: {
    error: "Active membership required to view referrals",
    code: "ACTIVE_MEMBERSHIP_REQUIRED",
  },
};
