import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../../collections/match-requests.js";
import type { NotifiedMatchRequest } from "../types/services.js";

/**
 * A range on the single field `memberNotificationSentAt` uses Firestore's
 * automatic single-field index; no composite index is needed.
 */
export async function listMatchRequestsNotifiedBetween({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): Promise<NotifiedMatchRequest[]> {
  const snapshot = await getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .where("memberNotificationSentAt", ">=", Timestamp.fromDate(from))
    .where("memberNotificationSentAt", "<=", Timestamp.fromDate(to))
    .get();

  return snapshot.docs.map(document => ({
    id: document.id,
    matchRequest: document.data() as MatchRequestDocument,
  }));
}
