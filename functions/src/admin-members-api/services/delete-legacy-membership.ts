import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION } from "../../collections/index.js";

/**
 * Delete a linked Legacy Membership's `migrated_users_import` record.
 * Deleting a record that is already gone is a no-op.
 *
 * @param options.legacyEmail - The import document ID, exactly as stored
 */
export async function deleteLegacyMembership({
  legacyEmail,
}: {
  legacyEmail: string;
}): Promise<void> {
  await getFirestore().collection(IMPORT_COLLECTION).doc(legacyEmail).delete();
}
