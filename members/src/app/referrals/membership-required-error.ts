/**
 * Thrown when the API answers 403 for a lapsed membership: the Referral
 * Portal is on, but this member has no active membership.
 * Pages render "Active membership required" with a link to `/membership`.
 */
export class MembershipRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super('Active membership required to view referrals.', options);
    this.name = 'MembershipRequiredError';
  }
}
