import {
  type DocumentReference,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../../../collections/match-requests.js";
import {
  MEMBER_RESPONSES_SUBCOLLECTION,
  type MemberResponseDocument,
} from "../../../collections/member-responses.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { NotFoundError } from "../../../shared-api/errors/http-error.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import { referralOpenCutoff } from "../../access/referral-open-cutoff.js";
import type { ReferralItem, ReferralsService } from "./interface.js";

/**
 * Lists open Referrals (submitted within the last 14 days, inclusive), newest first.
 */
async function listReferrals(logger: Logger): Promise<ReferralItem[]> {
  try {
    const firestore = getFirestore();
    const cutoff = Timestamp.fromDate(referralOpenCutoff());
    const snapshot = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .where("submitted", ">=", cutoff)
      .orderBy("submitted", "desc")
      .get();

    return snapshot.docs.map(matchDocument => ({
      id: matchDocument.id,
      document: matchDocument.data() as MatchRequestDocument,
    }));
  } catch (error) {
    logger.error("Failed to list referrals from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

async function getReferral(
  requestId: string,
  logger: Logger,
): Promise<ReferralItem> {
  try {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .doc(requestId)
      .get();

    if (!snapshot.exists) {
      logger.warn("Referral not found", {
        errorId: ERROR_IDS.API_MEMBER_REFERRAL_NOT_FOUND,
        requestId,
      });
      throw new NotFoundError(`Referral ${requestId} not found`);
    }

    return {
      id: snapshot.id,
      document: snapshot.data() as MatchRequestDocument,
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;

    logger.error("Failed to get referral from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      requestId,
    });
    throw error;
  }
}

/**
 * Referrals of any age that hold a response document for this Member.
 * Uses the collection-group `memberUid` index (see firestore.indexes.json).
 */
async function listReferralsWithMemberResponse(
  memberUid: string,
  logger: Logger,
): Promise<ReferralItem[]> {
  try {
    const firestore = getFirestore();
    const responses = await firestore
      .collectionGroup(MEMBER_RESPONSES_SUBCOLLECTION)
      .where("memberUid", "==", memberUid)
      .get();

    const referralReferences = responses.docs
      .map(response => response.ref.parent.parent)
      .filter(
        (reference): reference is DocumentReference =>
          reference?.parent.id === MATCH_REQUESTS_COLLECTION,
      );
    if (referralReferences.length === 0) return [];

    const snapshots = await firestore.getAll(...referralReferences);
    return snapshots
      .filter(snapshot => snapshot.exists)
      .map(snapshot => ({
        id: snapshot.id,
        document: snapshot.data() as MatchRequestDocument,
      }));
  } catch (error) {
    logger.error("Failed to list a member's referrals from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      memberUid,
    });
    throw error;
  }
}

async function listMemberResponses(
  requestId: string,
  logger: Logger,
): Promise<MemberResponseDocument[]> {
  try {
    const snapshot = await getFirestore()
      .collection(MATCH_REQUESTS_COLLECTION)
      .doc(requestId)
      .collection(MEMBER_RESPONSES_SUBCOLLECTION)
      .get();

    return snapshot.docs.map(response => ({
      ...(response.data() as MemberResponseDocument),
      memberUid: response.id,
    }));
  } catch (error) {
    logger.error("Failed to list member responses from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      requestId,
    });
    throw error;
  }
}

export const ReferralsServiceImpl: ReferralsService = {
  listReferrals,
  getReferral,
  listReferralsWithMemberResponse,
  listMemberResponses,
};
