import { Timestamp } from "firebase-admin/firestore";
import type {
  MemberResponseDocument,
  ReferralOutcome,
} from "../../collections/member-responses.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canRecordReferralOutcome } from "../access/can-record-referral-outcome.js";
import { REFERRAL_PORTAL_DENIAL } from "../access/referral-portal-denial.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import type { ReferralOutcomeResponse } from "../schemas/referral-schemas.js";
import { summarizeMemberResponses } from "../schemas/summarize-member-responses.js";
import { toOutcomeFields } from "../schemas/to-outcome-fields.js";
import type { MemberService } from "../services/member/interface.js";
import type { ReferralOutcomeService } from "../services/referral-outcome/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

interface ErrorBody {
  error: string;
  code?: string;
}

const OUTCOME_ERRORS = {
  notSelf: {
    error: "You can only record your own Referral Outcome",
    code: "OUTCOME_NOT_SELF",
  },
  requiresOutreach: {
    error: "Send Outreach on this referral before recording an outcome",
    code: "OUTCOME_REQUIRES_OUTREACH",
  },
} satisfies Record<string, ErrorBody>;

/**
 * Set, change or clear (`outcome` undefined) the requester's own Referral
 * Outcome on a Referral. Owner only, after their own Outreach. Stores the
 * current value and its time, with no history. Responds with the new value
 * and the recomputed hired badge.
 */
export async function recordReferralOutcomeLogic({
  memberId,
  requestId,
  outcome,
  memberService,
  referralsService,
  referralPortalSettingsService,
  referralOutcomeService,
  authService,
  logger,
  authorizationHeader,
  set,
  now = () => new Date(),
}: {
  memberId: string;
  requestId: string;
  /** The Outcome to record; undefined clears it. */
  outcome: ReferralOutcome | undefined;
  memberService: MemberService;
  referralsService: ReferralsService;
  referralPortalSettingsService: ReferralPortalSettingsService;
  referralOutcomeService: ReferralOutcomeService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
  now?: () => Date;
}): Promise<ReferralOutcomeResponse | ErrorBody> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );
    // Admins pass verifyOwnerOrAdmin, but never record an Outcome for someone else.
    if (decodedToken.uid !== memberId) {
      set.status = 403;
      return OUTCOME_ERRORS.notSelf;
    }

    const access = await resolveReferralPortalAccess({
      decodedToken,
      loadMember: () => memberService.findById(memberId),
      referralPortalSettingsService,
      logger,
    });
    if (access !== "allowed") {
      set.status = 403;
      return REFERRAL_PORTAL_DENIAL[access];
    }

    // 404 when the Referral doesn't exist. No window check: the prerequisite
    // (own Outreach) already keeps the Referral visible to this Member.
    await referralsService.getReferral(requestId, logger);
    const responses = await referralsService.listMemberResponses(
      requestId,
      logger,
    );
    const ownResponse = responses.find(
      response => response.memberUid === memberId,
    );
    if (!canRecordReferralOutcome(ownResponse)) {
      set.status = 403;
      return OUTCOME_ERRORS.requiresOutreach;
    }

    const target = { requestId, memberUid: memberId };
    const updated: MemberResponseDocument = {
      ...ownResponse,
      memberUid: memberId,
    };
    if (outcome === undefined) {
      await referralOutcomeService.clearOutcome(target, logger);
      delete updated.outcome;
      delete updated.outcomeUpdatedAt;
    } else {
      const updatedAt = now();
      await referralOutcomeService.setOutcome(
        { ...target, outcome, updatedAt },
        logger,
      );
      updated.outcome = outcome;
      updated.outcomeUpdatedAt = Timestamp.fromDate(updatedAt);
    }

    const summary = summarizeMemberResponses(
      [
        ...responses.filter(response => response.memberUid !== memberId),
        updated,
      ],
      memberId,
    );
    return toOutcomeFields(summary);
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to record Referral Outcome", {
      errorId: ERROR_IDS.API_MEMBER_RECORD_REFERRAL_OUTCOME_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
      requestId,
    });

    set.status = 500;
    return { error: "Failed to save your outcome. Please try again." };
  }
}
