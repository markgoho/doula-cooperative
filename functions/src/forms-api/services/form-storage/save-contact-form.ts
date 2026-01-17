import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  MESSAGES_COLLECTION,
  type MessageDocument,
} from "../../../collections/messages.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { ContactFormData } from "./types.js";

/**
 * Save a contact form submission to Firestore.
 *
 * The emailSent flag tracks whether the notification email successfully sent.
 * This allows manual follow-up for submissions where email delivery failed.
 * Firestore document serves as the source of truth for all submissions.
 *
 * @param data - The contact form data
 * @param recaptchaScore - The reCAPTCHA verification score
 * @param emailSent - Whether the notification email was successfully sent (defaults to false)
 * @throws Error if Firestore write fails
 */
export async function saveContactForm({
  data,
  recaptchaScore,
  emailSent = false,
}: {
  data: ContactFormData;
  recaptchaScore: number;
  emailSent?: boolean;
}): Promise<void> {
  const firestore = getFirestore();

  const document: MessageDocument = {
    ...data,
    submitted: Timestamp.now(),
    sent: emailSent,
    recaptchaScore,
  };

  try {
    await firestore.collection(MESSAGES_COLLECTION).add(document);
  } catch (error) {
    logger.error("Failed to save contact form to Firestore", {
      errorId: ERROR_IDS.CONTACT_FORM_FIRESTORE_WRITE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      emailSent, // Critical: indicates if email was already sent
      email: data.email,
      recaptchaScore,
    });

    // Re-throw with context - this is a critical failure
    throw new Error(
      `Failed to save contact form to Firestore after email ${emailSent ? "was sent" : "failed"}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
