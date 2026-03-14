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
  /**
   * The name of the user.
   */
  name?: string;
  /**
   * The email of the user.
   */
  email: string;
  /**
   * The slug of the user.
   */
  slug?: string;
  /**
   * The start date of the user's subscription.
   */
  subscriptionStart: Timestamp;
  /**
   * The last payment date of the user's subscription.
   */
  lastPayment: Timestamp;
  /**
   * The next payment date of the user's subscription.
   */
  nextPayment: Timestamp;
  /**
   * The status of the user's invitation email.
   */
  invitationEmailStatus?: "sent" | "failed" | "pending";
  /**
   * The date the user's invitation email was sent.
   */
  invitationEmailSentAt?: Timestamp;
  /**
   * The error message from the user's invitation email.
   */
  invitationEmailError?: string;
  /**
   * The date the profile was originally created in the legacy system.
   */
  createdAt?: Timestamp;
  /**
   * The date the profile was last updated in the legacy system.
   */
  updatedAt?: Timestamp;
}

/**
 * Unclaimed profile with email included (used in API responses).
 */
export interface UnclaimedProfileDocument extends UnclaimedProfileDocumentData {
  email: string;
}
