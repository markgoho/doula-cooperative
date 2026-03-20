import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";
import { buildDoulaMatchNotification } from "../services/build-doula-match-notification.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { DoulaMatchData } from "../services/form-storage/types.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { checkRecaptchaScore } from "../utils/check-recaptcha-score.js";

export async function handleMatchFormLogic({
  formData,
  recaptchaToken,
  recaptchaSecretKey,
  recaptchaService,
  formStorageService,
  emailService,
  logger,
  set,
}: {
  formData: DoulaMatchData;
  recaptchaToken: string;
  recaptchaSecretKey: string;
  recaptchaService: RecaptchaService;
  formStorageService: FormStorageService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<FormResponse> {
  try {
    // Verify reCAPTCHA token
    const verification = await recaptchaService.verifyToken({
      token: recaptchaToken,
      secretKey: recaptchaSecretKey,
      logger,
    });

    if (!verification.success) {
      logger.warn("reCAPTCHA verification failed for doula match form", {
        errorId: ERROR_IDS.RECAPTCHA_VERIFICATION_FAILED,
        error: verification.error,
      });
      set.status = 400;
      return { success: false, error: "reCAPTCHA verification failed" };
    }

    // Check reCAPTCHA score threshold to block bots
    const scoreRejection = checkRecaptchaScore({
      score: verification.score,
      submitterEmail: formData.email,
      submitterName: formData.name,
      formType: "doula match form",
      logger,
      set,
    });
    if (scoreRejection !== undefined) {
      return scoreRejection;
    }

    // Try to send notification email first
    let emailSent = false;
    let warning: string | undefined;

    try {
      const emailMessage = buildDoulaMatchNotification(formData);
      await emailService.sendEmail({ message: emailMessage }, logger);
      emailSent = true;
    } catch (emailError: unknown) {
      logger.error("CRITICAL: Failed to send doula match notification email", {
        errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
        severity: "CRITICAL",
        error: emailError,
        errorMessage:
          emailError instanceof Error ? emailError.message : "Unknown error",
        errorStack: emailError instanceof Error ? emailError.stack : undefined,
        formType: "doula_match",
        submitterEmail: formData.email,
        submitterName: formData.name,
        recaptchaScore: verification.score,
        timestamp: new Date().toISOString(),
      });

      warning = "Form saved but notification email failed to send";
    }

    // Save form to Firestore with email send status
    await formStorageService.saveMatchRequest({
      data: formData,
      recaptchaScore: verification.score,
      emailSent,
    });

    logger.info("Doula match form submitted successfully", {
      email: formData.email,
      recaptchaScore: verification.score,
      emailSent,
    });

    set.status = 200;
    const result: FormResponse = {
      success: true,
      message: "Form submitted successfully",
      emailSent,
    };

    if (warning) {
      result.warning = warning;
    }

    return result;
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { success: false, error: error.message };
    }

    logger.error("Failed to process doula match form", {
      errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    set.status = 500;
    return { success: false, error: "Internal server error" };
  }
}
