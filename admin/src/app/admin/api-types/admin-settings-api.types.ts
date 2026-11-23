/**
 * Referral Portal v2 switch, as returned by GET/PATCH /api/admin/settings/referral-portal.
 * `updatedAt`/`updatedBy` are absent until an Admin flips the switch for the first time.
 */
export interface ReferralPortalSettings {
  v2Enabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}
