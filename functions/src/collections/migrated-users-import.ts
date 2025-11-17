import { Timestamp } from "firebase-admin/firestore";

/**
 * Migrated users import collection: stores unclaimed profiles from legacy system
 * Documents are keyed by email address (document ID = email)
 */
export const IMPORT_COLLECTION = "migrated_users_import";

/**
 * Unclaimed profile document stored in Firestore.
 * Note: The email is stored as the document ID, not as a field in the document.
 */
export interface UnclaimedProfileDocumentData {
  name: string;
  subscriptionStart: Timestamp;
  slug?: string;
  invitationEmailStatus?: "sent" | "failed" | "pending";
  invitationEmailSentAt?: Timestamp;
  invitationEmailError?: string;
}

/**
 * Unclaimed profile with email included (used in API responses).
 */
export interface UnclaimedProfileDocument extends UnclaimedProfileDocumentData {
  email: string;
}
