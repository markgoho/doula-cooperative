import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../../collections/match-requests.js";
import {
  MEMBER_RESPONSES_SUBCOLLECTION,
  type ReferralOutcome,
} from "../../../collections/member-responses.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import type {
  ReferralOutcomeService,
  ReferralOutcomeTarget,
} from "./interface.js";

function memberResponseReference({
  requestId,
  memberUid,
}: ReferralOutcomeTarget) {
  return getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(requestId)
    .collection(MEMBER_RESPONSES_SUBCOLLECTION)
    .doc(memberUid);
}

async function setOutcome(
  {
    requestId,
    memberUid,
    outcome,
    updatedAt,
  }: ReferralOutcomeTarget & { outcome: ReferralOutcome; updatedAt: Date },
  logger: Logger,
): Promise<void> {
  try {
    await memberResponseReference({ requestId, memberUid }).set(
      { outcome, outcomeUpdatedAt: Timestamp.fromDate(updatedAt) },
      { merge: true },
    );
  } catch (error) {
    logger.error("Failed to set Referral Outcome in Firestore", {
      errorId: ERROR_IDS.API_MEMBER_REFERRAL_OUTCOME_WRITE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      requestId,
      memberUid,
    });
    throw error;
  }
}

async function clearOutcome(
  target: ReferralOutcomeTarget,
  logger: Logger,
): Promise<void> {
  try {
    await memberResponseReference(target).set(
      { outcome: FieldValue.delete(), outcomeUpdatedAt: FieldValue.delete() },
      { merge: true },
    );
  } catch (error) {
    logger.error("Failed to clear Referral Outcome in Firestore", {
      errorId: ERROR_IDS.API_MEMBER_REFERRAL_OUTCOME_WRITE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      ...target,
    });
    throw error;
  }
}

export const ReferralOutcomeServiceImpl: ReferralOutcomeService = {
  setOutcome,
  clearOutcome,
};
