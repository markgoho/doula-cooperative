/**
 * API representation of the Referral Portal v2 rollout gate.
 * `updatedAt`/`updatedBy` are absent when the switch has never been written.
 */
export interface ReferralPortalSettings {
  v2Enabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Reads and writes the `settings/referralPortal` document.
 * Firestore access only; access rules live in the callers.
 */
export interface ReferralPortalSettingsService {
  /** Returns the current switch state; a missing document means off. */
  getReferralPortalSettings(): Promise<ReferralPortalSettings>;

  /** Persists the switch state with a server timestamp and the Admin's UID. */
  updateReferralPortalSettings(options: {
    v2Enabled: boolean;
    updatedBy: string;
  }): Promise<ReferralPortalSettings>;
}
