import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { ReferralOutcome } from "../../collections/member-responses.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canRecordOfflineResponses } from "../access/can-record-offline-responses.js";
import type { ReferralOutcomeResponse } from "../schemas/referral-schemas.js";
import { summarizeMemberResponses } from "../schemas/summarize-member-responses.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
import type { OfflineResponseService } from "../services/offline-response/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

interface ErrorBody {
  error: string;
  code?: string;
}

const LEGACY_OUTCOME_ERRORS = {
  coordinatorRequired: {
    error:
      "Only the Referral Coordinator can record an outcome for a doula not yet migrated",
    code: "REFERRAL_COORDINATOR_REQUIRED",
  },
  notFound: {
    error: "That Offline Response was deleted or its doula was linked",
    code: "OFFLINE_RESPONSE_NOT_FOUND",
  },
} satisfies Record<string, ErrorBody>;

/**
 * Set, change or clear (`outcome` undefined) the Referral Outcome of an
 * Unclaimed Legacy Membership with an Offline Response on a Referral.
 * Referral Coordinators only, on their own path: the doula has no portal
 * account to record it. Members always record their own, so only Legacy
 * Memberships are addressable here. Stores the current value, its time and
 * who set it, with no history. Responds with the doula's Outcome and the
 * recomputed hired badge.
 */
export async function recordLegacyOutcomeLogic({
  memberId,
  requestId,
  id,
  outcome,
  referralsService,
  offlineResponseService,
  authService,
  logger,
  authorizationHeader,
  set,
  now = () => new Date(),
}: {
  memberId: string;
  requestId: string;
  /** The Legacy Membership's opaque id, as the Coordinator panel lists it. */
  id: string;
  /** The Outcome to record; undefined clears it. */
  outcome: ReferralOutcome | undefined;
  referralsService: ReferralsService;
  offlineResponseService: OfflineResponseService;
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
    if (
      decodedToken.uid !== memberId ||
      !canRecordOfflineResponses(decodedToken)
    ) {
      set.status = 403;
      return LEGACY_OUTCOME_ERRORS.coordinatorRequired;
    }

    // 404 when the Referral doesn't exist.
    await referralsService.getReferral(requestId, logger);
    // Resolved against the Referral's own records, so it still works after
    // the Legacy Membership's import document is gone. Member responses only
    // feed the hired badge.
    const [responses, legacyResponses] = await Promise.all([
      referralsService.listMemberResponses(requestId, logger),
      referralsService.listLegacyResponses(requestId, logger),
    ]);
    const legacy = legacyResponses.find(
      ({ legacyEmail }) => toLegacyDoulaId(legacyEmail) === id,
    );
    if (!legacy) {
      set.status = 404;
      return LEGACY_OUTCOME_ERRORS.notFound;
    }

    const target = { requestId, legacyEmail: legacy.legacyEmail };
    const updatedAt = now();
    const written =
      outcome === undefined
        ? await offlineResponseService.clearLegacyOutcome(target, logger)
        : await offlineResponseService.setLegacyOutcome(
            { ...target, outcome, updatedAt, recordedBy: decodedToken.uid },
            logger,
          );
    if (written === "not_found") {
      set.status = 404;
      return LEGACY_OUTCOME_ERRORS.notFound;
    }

    const updated: LegacyResponseDocument = { ...legacy };
    delete updated.outcome;
    if (outcome !== undefined) updated.outcome = outcome;
    const { hiredBadge } = summarizeMemberResponses(responses, memberId, [
      ...legacyResponses.filter(response => response !== legacy),
      updated,
    ]);
    if (outcome === undefined) return { hiredBadge };
    return {
      outcome,
      outcomeUpdatedAt: updatedAt.toISOString(),
      hiredBadge,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to record a Legacy Membership's Referral Outcome", {
      errorId: ERROR_IDS.API_MEMBER_RECORD_LEGACY_OUTCOME_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
      requestId,
    });

    set.status = 500;
    return { error: "Failed to save the outcome. Please try again." };
  }
}
