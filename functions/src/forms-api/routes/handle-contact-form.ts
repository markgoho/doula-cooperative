import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";
import { buildContactFormNotification } from "../services/build-contact-form-notification.js";
import { detectGibberish } from "../utils/detect-gibberish.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { ContactFormData } from "../services/form-storage/types.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { checkRecaptchaScore } from "../utils/check-recaptcha-score.js";

export async function handleContactFormLogic({
  formData,
  recaptchaToken,
  honeypotValue,
  formLoadedAt,
  recaptchaSecretKey,
  recaptchaService,
  formStorageService,
  emailService,
  logger,
  set,
}: {
  formData: ContactFormData;
  recaptchaToken: string;
  honeypotValue: string | undefined;
  formLoadedAt: number | undefined;
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
      logger.warn("reCAPTCHA verification failed for contact form", {
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
      submitterName: formData.contactName,
      formType: "contact form",
      logger,
      set,
    });
    if (scoreRejection !== undefined) {
      return scoreRejection;
    }

    if (honeypotValue !== undefined && honeypotValue.trim() !== "") {
      logger.warn("Contact form submission rejected by honeypot", {
        errorId: ERROR_IDS.CONTACT_FORM_PROCESSING_FAILED,
        reason: "honeypot_filled",
        submitterEmail: formData.email,
        submitterName: formData.contactName,
      });
      set.status = 400;
      return { success: false, error: "Invalid form submission" };
    }

    const nameLooksLikeGibberish = detectGibberish({
      text: formData.contactName,
    });
    const messageLooksLikeGibberish = detectGibberish({
      text: formData.message,
    });

    if (nameLooksLikeGibberish || messageLooksLikeGibberish) {
      logger.warn("Contact form submission rejected as gibberish", {
        errorId: ERROR_IDS.CONTACT_FORM_PROCESSING_FAILED,
        reason: "gibberish_detected",
        submitterEmail: formData.email,
        submitterName: formData.contactName,
        nameLooksLikeGibberish,
        messageLooksLikeGibberish,
      });
      set.status = 400;
      return { success: false, error: "Invalid form submission" };
    }

    if (formLoadedAt !== undefined && Date.now() - formLoadedAt < 3000) {
      logger.warn("Contact form submission rejected as too fast", {
        errorId: ERROR_IDS.CONTACT_FORM_PROCESSING_FAILED,
        reason: "submitted_too_fast",
        submitterEmail: formData.email,
        submitterName: formData.contactName,
        formLoadedAt,
      });
      set.status = 400;
      return { success: false, error: "Invalid form submission" };
    }

    // Try to send notification email first
    let emailSent = false;
    let warning: string | undefined;

    try {
      const emailMessage = buildContactFormNotification(formData);
      await emailService.sendEmail({ message: emailMessage }, logger);
      emailSent = true;
    } catch (emailError: unknown) {
      logger.error("CRITICAL: Failed to send contact form notification email", {
        errorId: ERROR_IDS.CONTACT_FORM_PROCESSING_FAILED,
        severity: "CRITICAL",
        error: emailError,
        errorMessage:
          emailError instanceof Error ? emailError.message : "Unknown error",
        errorStack: emailError instanceof Error ? emailError.stack : undefined,
        formType: "contact_form",
        submitterEmail: formData.email,
        submitterName: formData.contactName,
        recaptchaScore: verification.score,
        timestamp: new Date().toISOString(),
      });

      warning = "Form saved but notification email failed to send";
    }

    // Save form to Firestore with email send status
    await formStorageService.saveContactForm({
      data: formData,
      recaptchaScore: verification.score,
      emailSent,
    });

    logger.info("Contact form submitted successfully", {
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

    logger.error("Failed to process contact form", {
      errorId: ERROR_IDS.CONTACT_FORM_PROCESSING_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    set.status = 500;
    return { success: false, error: "Internal server error" };
  }
}
