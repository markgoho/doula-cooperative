import type { Timestamp } from "firebase-admin/firestore";

/**
 * Messages collection: stores contact form submissions
 */
export const MESSAGES_COLLECTION = "messages";

export interface MessageDocument {
  contactName: string;
  email: string;
  message: string;
  submitted: Timestamp;
  sent: boolean;
  recaptchaScore?: number;
}
