import { getFirestore } from "firebase-admin/firestore";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../../collections/match-requests.js";

export async function getMatchRequest(
  matchRequestId: string,
): Promise<MatchRequestDocument | undefined> {
  const snapshot = await getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(matchRequestId)
    .get();

  return snapshot.data() as MatchRequestDocument | undefined;
}
