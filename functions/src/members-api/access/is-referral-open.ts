import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import { referralOpenCutoff } from "./referral-open-cutoff.js";

/**
 * Whether a Referral is still open (under 14 days old, inclusive boundary).
 *
 * The single place that decides "open": the list's `isOpen`, the window for
 * ordinary Members, and whether anyone (Admins and Referral Coordinators
 * included) may still send Outreach.
 *
 * Older Match Requests store `submitted` as an ISO string rather than a
 * Timestamp, so read it through `timestampToIso`.
 */
export function isReferralOpen(
  document: Pick<MatchRequestDocument, "submitted">,
  now: Date = new Date(),
): boolean {
  const submittedAt = Date.parse(timestampToIso(document.submitted));
  return submittedAt >= referralOpenCutoff(now).getTime();
}
