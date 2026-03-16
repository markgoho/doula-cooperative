import type { DocumentSnapshot, UpdateData } from "firebase-admin/firestore";
import type { MemberDocument } from "../../../types/member-document.js";

/**
 * Service interface for Firestore operations on the members collection.
 * Abstracts Firestore operations to enable testing without emulators and reduce duplication.
 *
 * This service is responsible ONLY for Firestore operations - no business logic.
 * Business rules should be implemented in service layers that use this service.
 */
export interface MemberFirestoreService {
  /**
   * Get a member document by user ID.
   * @param uid - The user ID (Firestore document ID)
   * @returns Promise resolving to the document snapshot
   */
  getMemberByUid(uid: string): Promise<DocumentSnapshot>;

  /**
   * Check if a member document exists.
   * @param uid - The user ID (Firestore document ID)
   * @returns Promise resolving to true if the document exists, false otherwise
   */
  memberExists(uid: string): Promise<boolean>;

  /**
   * Write or merge member document data.
   * Uses set with merge:true to create or update without overwriting existing fields.
   * @param uid - The user ID (Firestore document ID)
   * @param data - Partial member data to write/merge
   */
  writeMember(uid: string, data: Partial<MemberDocument>): Promise<void>;

  /**
   * Update specific fields in a member document.
   * Document must already exist or this will fail.
   * Supports FieldValue instances like serverTimestamp(), increment(), etc.
   * @param uid - The user ID (Firestore document ID)
   * @param data - Update data (supports FieldValue for special operations)
   */
  updateMember(uid: string, data: UpdateData<MemberDocument>): Promise<void>;

  /**
   * Delete a member document.
   * @param uid - The user ID (Firestore document ID)
   */
  deleteMember(uid: string): Promise<void>;
}
