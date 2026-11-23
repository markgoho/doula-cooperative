import { getFirestore } from "firebase-admin/firestore";
import { LEGACY_RESPONSES_SUBCOLLECTION } from "../../collections/legacy-responses.js";
import { MATCH_REQUESTS_COLLECTION } from "../../collections/match-requests.js";
import {
  MEMBER_RESPONSES_SUBCOLLECTION,
  type MemberResponseDocument,
} from "../../collections/member-responses.js";
import type { ReferralResponses } from "../types/services.js";

export async function listReferralResponses(
  matchRequestId: string,
): Promise<ReferralResponses> {
  const matchRequestReference = getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(matchRequestId);

  const [memberResponsesSnapshot, legacyResponsesCount] = await Promise.all([
    matchRequestReference.collection(MEMBER_RESPONSES_SUBCOLLECTION).get(),
    matchRequestReference
      .collection(LEGACY_RESPONSES_SUBCOLLECTION)
      .count()
      .get(),
  ]);

  return {
    memberResponses: memberResponsesSnapshot.docs.map(
      document => document.data() as MemberResponseDocument,
    ),
    legacyResponseCount: legacyResponsesCount.data().count,
  };
}
