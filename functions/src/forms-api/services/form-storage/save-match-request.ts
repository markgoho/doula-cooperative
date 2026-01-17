import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../../../collections/match-requests.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { DoulaMatchData } from "./types.js";

/**
 * Save a doula match request submission to Firestore.
 *
 * The emailSent flag tracks whether the notification email successfully sent.
 * This allows manual follow-up for submissions where email delivery failed.
 * Firestore document serves as the source of truth for all submissions.
 *
 * @param data - The doula match request data
 * @param recaptchaScore - The reCAPTCHA verification score
 * @param emailSent - Whether the notification email was successfully sent (defaults to false)
 * @throws Error if Firestore write fails
 */
export async function saveMatchRequest({
  data,
  recaptchaScore,
  emailSent = false,
}: {
  data: DoulaMatchData;
  recaptchaScore: number;
  emailSent?: boolean;
}): Promise<void> {
  const firestore = getFirestore();

  const document: MatchRequestDocument = {
    ...data,
    submitted: Timestamp.now(),
    sent: emailSent,
    recaptchaScore,
  };

  try {
    await firestore.collection(MATCH_REQUESTS_COLLECTION).add(document);
  } catch (error) {
    logger.error("Failed to save doula match request to Firestore", {
      errorId: ERROR_IDS.DOULA_MATCH_FORM_FIRESTORE_WRITE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      emailSent, // Critical: indicates if email was already sent
      email: data.email,
      recaptchaScore,
    });

    // Re-throw with context - this is a critical failure
    throw new Error(
      `Failed to save doula match request to Firestore after email ${emailSent ? "was sent" : "failed"}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
