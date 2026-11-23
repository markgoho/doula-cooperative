import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../collections/match-requests.js";

export async function markMemberNotificationSent(
  matchRequestId: string,
): Promise<void> {
  await getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(matchRequestId)
    .update({ memberNotificationSentAt: FieldValue.serverTimestamp() });
}
