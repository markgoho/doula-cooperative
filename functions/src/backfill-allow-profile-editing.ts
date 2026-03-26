import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "./collections/index.js";

const PROFILE_APPROVAL_CUTOFF = new Timestamp(0, 1);
const MAX_BATCH_SIZE = 500;

export async function backfillAllowProfileEditing(): Promise<void> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(MEMBERS_COLLECTION)
    .where("profileApprovedAt", ">", PROFILE_APPROVAL_CUTOFF)
    .get();

  if (snapshot.empty) {
    return;
  }

  for (let index = 0; index < snapshot.docs.length; index += MAX_BATCH_SIZE) {
    const batch = firestore.batch();

    for (const document of snapshot.docs.slice(index, index + MAX_BATCH_SIZE)) {
      batch.update(document.ref, {
        allowProfileEditing: true,
      });
    }

    await batch.commit();
  }
}
