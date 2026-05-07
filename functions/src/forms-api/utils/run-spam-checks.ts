import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";
import { checkRecaptchaScore } from "./check-recaptcha-score.js";
import { detectGibberish } from "./detect-gibberish.js";

export interface SpamPolicy {
  recaptcha: { score: number };
  honeypot?: { value: string | undefined };
  gibberish?: { fieldName: string; text: string }[];
  timing?: { formLoadedAt: number | undefined; minMillis: number };
}

export function runSpamChecks({
  policy,
  submitterEmail,
  submitterName,
  formType,
  errorId,
  logger,
  set,
}: {
  policy: SpamPolicy;
  submitterEmail: string;
  submitterName: string;
  formType: string;
  errorId: string;
  logger: Logger;
  set: { status?: number | string };
}): FormResponse | undefined {
  const scoreRejection = checkRecaptchaScore({
    score: policy.recaptcha.score,
    submitterEmail,
    submitterName,
    formType,
    logger,
    set,
  });
  if (scoreRejection !== undefined) {
    return scoreRejection;
  }

  if (policy.honeypot !== undefined) {
    const { value } = policy.honeypot;
    if (value !== undefined && value.trim() !== "") {
      logger.warn(`${formType} submission rejected by honeypot`, {
        errorId,
        reason: "honeypot_filled",
        submitterEmail,
        submitterName,
      });
      set.status = 400;
      return { success: false, error: "Invalid form submission" };
    }
  }

  if (policy.gibberish !== undefined && policy.gibberish.length > 0) {
    const flagged = policy.gibberish.filter(field =>
      detectGibberish({ text: field.text }),
    );
    if (flagged.length > 0) {
      logger.warn(`${formType} submission rejected as gibberish`, {
        errorId,
        reason: "gibberish_detected",
        submitterEmail,
        submitterName,
        flaggedFields: flagged.map(field => field.fieldName),
      });
      set.status = 400;
      return { success: false, error: "Invalid form submission" };
    }
  }

  if (policy.timing !== undefined) {
    const { formLoadedAt, minMillis } = policy.timing;
    if (formLoadedAt !== undefined && Date.now() - formLoadedAt < minMillis) {
      logger.warn(`${formType} submission rejected as too fast`, {
        errorId,
        reason: "submitted_too_fast",
        submitterEmail,
        submitterName,
        formLoadedAt,
      });
      set.status = 400;
      return { success: false, error: "Invalid form submission" };
    }
  }

  return undefined;
}
