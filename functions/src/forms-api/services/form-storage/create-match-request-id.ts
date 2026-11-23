import { getFirestore } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../../collections/match-requests.js";

/**
 * Allocate a Firestore document id for a new Match Request without writing.
 *
 * Lets the Match Request Notification link to the admin detail page before
 * the document is saved, so the existing send-then-persist order is kept.
 */
export function createMatchRequestId(): string {
  return getFirestore().collection(MATCH_REQUESTS_COLLECTION).doc().id;
}
