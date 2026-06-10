import { getFirestore } from "firebase-admin/firestore";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../../../collections/match-requests.js";
import { NotFoundError } from "../../../shared-api/errors/http-error.js";
import type { ReferralItem, ReferralsService } from "./interface.js";

async function listReferrals(): Promise<ReferralItem[]> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(MATCH_REQUESTS_COLLECTION)
    .orderBy("submitted", "desc")
    .get();

  return snapshot.docs.map((matchDocument) => ({
    id: matchDocument.id,
    document: matchDocument.data() as MatchRequestDocument,
  }));
}

async function getReferral(requestId: string): Promise<ReferralItem> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(requestId)
    .get();

  if (!snapshot.exists) {
    throw new NotFoundError(`Referral ${requestId} not found`);
  }

  return {
    id: snapshot.id,
    document: snapshot.data() as MatchRequestDocument,
  };
}

export const ReferralsServiceImpl: ReferralsService = {
  listReferrals,
  getReferral,
};
