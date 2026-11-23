const REFERRAL_OPEN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The oldest `submitted` time at which a Referral is still open to Members.
 * A Referral submitted at or after this instant is open (inclusive boundary).
 * Shared by the list query and the detail check so both use the same window.
 */
export function referralOpenCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - REFERRAL_OPEN_DAYS * DAY_MS);
}
