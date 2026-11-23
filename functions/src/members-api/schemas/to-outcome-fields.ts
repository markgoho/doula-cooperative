import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralOutcomeResponse } from "./referral-schemas.js";
import type { MemberResponsesSummary } from "./summarize-member-responses.js";

/**
 * The viewer's own Referral Outcome and the hired badge, as every Referral
 * payload carries them. `outcome` and `outcomeUpdatedAt` are absent when the
 * viewer has none.
 */
export function toOutcomeFields({
  ownOutcome,
  ownOutcomeUpdatedAt,
  hiredBadge,
}: Pick<
  MemberResponsesSummary,
  "ownOutcome" | "ownOutcomeUpdatedAt" | "hiredBadge"
>): ReferralOutcomeResponse {
  return {
    ...(ownOutcome && { outcome: ownOutcome }),
    ...(ownOutcome &&
      ownOutcomeUpdatedAt && {
        outcomeUpdatedAt: timestampToIso(ownOutcomeUpdatedAt),
      }),
    hiredBadge,
  };
}
