import { getFirestore } from "firebase-admin/firestore";
import {
  LEGACY_RESPONSES_SUBCOLLECTION,
  type LegacyResponseDocument,
} from "../../collections/legacy-responses.js";
import { MATCH_REQUESTS_COLLECTION } from "../../collections/match-requests.js";

/**
 * Every Offline Response recorded for an Unclaimed Legacy Membership on a
 * Match Request, in document order.
 */
export async function listLegacyResponses(options: {
  requestId: string;
}): Promise<LegacyResponseDocument[]> {
  const snapshot = await getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(options.requestId)
    .collection(LEGACY_RESPONSES_SUBCOLLECTION)
    .get();

  return snapshot.docs.map(response => ({
    ...(response.data() as LegacyResponseDocument),
    legacyEmail: response.id,
  }));
}
