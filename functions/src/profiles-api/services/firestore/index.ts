import type { DocumentSnapshot } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  type MemberDocument,
} from "../../../collections/index.js";
import { MemberFirestoreService } from "../../../shared-api/services/member-firestore/index.js";
import type { ClaimProfileFirestoreService as ClaimProfileFirestoreServiceInterface } from "./interface.js";

/**
 * Get an import document by email address.
 */
async function getImportDocumentImpl(email: string): Promise<DocumentSnapshot> {
  const database = getFirestore();
  return database.collection(IMPORT_COLLECTION).doc(email).get();
}

/**
 * Write or merge member document data.
 * Delegates to the shared MemberFirestoreService.
 */
async function writeMemberDocumentImpl(
  uid: string,
  data: Partial<MemberDocument>,
): Promise<void> {
  await MemberFirestoreService.writeMember(uid, data);
}

/**
 * Delete an import document by email address.
 */
async function deleteImportDocumentImpl(email: string): Promise<void> {
  const database = getFirestore();
  await database.collection(IMPORT_COLLECTION).doc(email).delete();
}

export const ClaimProfileFirestoreService: ClaimProfileFirestoreServiceInterface =
  {
    getImportDocument: getImportDocumentImpl,
    writeMemberDocument: writeMemberDocumentImpl,
    deleteImportDocument: deleteImportDocumentImpl,
  };
