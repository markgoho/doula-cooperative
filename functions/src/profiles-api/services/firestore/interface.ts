import type { MemberDocument } from "@doula-coop/functions-shared/collections/index.js";
import type { DocumentSnapshot } from "firebase-admin/firestore";

/**
 * Service interface for Firestore operations in claim profile flow.
 * Abstracts Firestore operations to enable testing without emulators.
 */
export interface ClaimProfileFirestoreService {
  /**
   * Get an import document by email address.
   * @param email - The email address to look up in the import collection
   * @returns Promise resolving to the document snapshot
   */
  getImportDocument(email: string): Promise<DocumentSnapshot>;

  /**
   * Write or merge member document data.
   * @param uid - The user ID (Firestore document ID)
   * @param data - Partial member data to write/merge
   */
  writeMemberDocument(
    uid: string,
    data: Partial<MemberDocument>,
  ): Promise<void>;

  /**
   * Delete an import document by email address.
   * @param email - The email address of the import document to delete
   */
  deleteImportDocument(email: string): Promise<void>;
}
