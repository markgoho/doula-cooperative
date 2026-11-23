import type { MemberResponseDocument } from "../../collections/member-responses.js";

/**
 * Whether a Member may set, change or clear their Referral Outcome on a Referral.
 *
 * The single place that decides the prerequisite: the Member's own Outreach
 * (`outreachSentAt`; an in-flight send does not count). The "or an Offline
 * Response names this Member" unlock joins here once Offline Responses are
 * recorded.
 *
 * @param ownResponse - The Member's own response document on the Referral, if any
 */
export function canRecordReferralOutcome(
  ownResponse: MemberResponseDocument | undefined,
): boolean {
  return ownResponse?.outreachSentAt !== undefined;
}
