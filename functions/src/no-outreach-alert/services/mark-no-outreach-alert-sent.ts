import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../collections/match-requests.js";

export async function markNoOutreachAlertSent(
  matchRequestId: string,
): Promise<void> {
  await getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(matchRequestId)
    .update({ noOutreachAlertSentAt: FieldValue.serverTimestamp() });
}
