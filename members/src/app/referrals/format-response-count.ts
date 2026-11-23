/**
 * How many doulas have responded to a Referral (Outreach or an Offline Response).
 * No names: only the count is ever shown to other Members.
 */
export function formatResponseCount(responseCount: number): string {
  if (responseCount === 0) return 'No one has responded yet';
  if (responseCount === 1) return '1 member responded';
  return `${responseCount} members responded`;
}
