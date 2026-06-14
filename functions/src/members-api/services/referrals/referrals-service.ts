import { getFirestore } from "firebase-admin/firestore";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../../../collections/match-requests.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { NotFoundError } from "../../../shared-api/errors/http-error.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import type { ReferralItem, ReferralsService } from "./interface.js";

async function listReferrals(logger: Logger): Promise<ReferralItem[]> {
  try {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .orderBy("submitted", "desc")
      .get();

    return snapshot.docs.map((matchDocument) => ({
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

export const ReferralsServiceImpl: ReferralsService = {
  listReferrals,
  getReferral,
};
