/**
 * Thrown when the API answers 404 `REFERRAL_NOT_OPEN`: the Referral is
 * outside this member's 14-day window.
 */
export class ReferralNotOpenError extends Error {
  constructor(options?: ErrorOptions) {
    super('This referral is no longer open.', options);
    this.name = 'ReferralNotOpenError';
  }
}
