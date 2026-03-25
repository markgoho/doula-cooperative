import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "./collections/index.js";

export async function backfillAllowProfileEditing(): Promise<void> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(MEMBERS_COLLECTION)
    .where("profileApprovedAt", "!=", null)
    .get();

  if (snapshot.empty) {
    return;
  }

  const batch = firestore.batch();

  for (const document of snapshot.docs) {
    batch.update(document.ref, {
      allowProfileEditing: true,
    });
  }

  await batch.commit();
}
