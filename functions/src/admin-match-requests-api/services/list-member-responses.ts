import { getFirestore } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../collections/match-requests.js";
import {
  MEMBER_RESPONSES_SUBCOLLECTION,
  type MemberResponseDocument,
} from "../../collections/member-responses.js";

/**
 * Every Member response document on a Match Request (Outreach, Referral
 * Outcome, Offline Response), in document order.
 */
export async function listMemberResponses(options: {
  requestId: string;
}): Promise<MemberResponseDocument[]> {
  const snapshot = await getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(options.requestId)
    .collection(MEMBER_RESPONSES_SUBCOLLECTION)
    .get();

  return snapshot.docs.map(response => ({
    ...(response.data() as MemberResponseDocument),
    memberUid: response.id,
  }));
}
