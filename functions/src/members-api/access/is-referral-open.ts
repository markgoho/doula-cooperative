import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { referralOpenCutoff } from "./referral-open-cutoff.js";

/**
 * Whether a Referral is still open (under 14 days old, inclusive boundary).
 *
 * The single place that decides "open": the list's `isOpen`, the window for
 * ordinary Members, and whether anyone (Admins and Referral Coordinators
 * included) may still send Outreach.
 */
export function isReferralOpen(
  document: Pick<MatchRequestDocument, "submitted">,
  now: Date = new Date(),
): boolean {
  return document.submitted.toMillis() >= referralOpenCutoff(now).getTime();
}
