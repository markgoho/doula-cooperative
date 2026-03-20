import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";

const MINIMUM_RECAPTCHA_SCORE = 0.5;

/**
 * Checks whether a reCAPTCHA score meets the minimum threshold.
 *
 * Returns a rejection response if the score is too low, or undefined if the
 * score is acceptable and processing should continue.
 */
export function checkRecaptchaScore({
  score,
  submitterEmail,
  submitterName,
  formType,
  logger,
  set,
}: {
  score: number;
  submitterEmail: string;
  submitterName: string;
  formType: string;
  logger: Logger;
  set: { status?: number | string };
}): FormResponse | undefined {
  if (score >= MINIMUM_RECAPTCHA_SCORE) {
    return undefined;
  }

  logger.warn(`reCAPTCHA score below threshold for ${formType}`, {
    errorId: ERROR_IDS.RECAPTCHA_SCORE_TOO_LOW,
    score,
    threshold: MINIMUM_RECAPTCHA_SCORE,
    submitterEmail,
    submitterName,
  });
  set.status = 400;
  return { success: false, error: "reCAPTCHA verification failed" };
}
