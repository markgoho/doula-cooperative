/**
 * Thrown when the API answers 403 `REFERRAL_PORTAL_DISABLED`: the Referral
 * Portal v2 switch is off and this member has no preview access.
 * Pages render a friendly "not available yet" state instead of an error.
 */
export class ReferralPortalDisabledError extends Error {
  constructor(options?: ErrorOptions) {
    super('The referral portal is not available yet.', options);
    this.name = 'ReferralPortalDisabledError';
  }
}
