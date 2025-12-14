import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { buildDoulaMatchNotification } from "../services/build-doula-match-notification.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { DoulaMatchData } from "../services/form-storage/types.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";

export interface FormResponse {
  success: boolean;
  message?: string;
  error?: string;
  emailSent?: boolean;
  warning?: string;
}

export async function handleMatchFormLogic({
  formData,
  recaptchaToken,
  recaptchaSecretKey,
  recaptchaService,
  formStorageService,
  emailService,
  mailgunApiKey,
  logger,
  set,
}: {
  formData: DoulaMatchData;
  recaptchaToken: string;
  recaptchaSecretKey: string;
  recaptchaService: RecaptchaService;
  formStorageService: FormStorageService;
  emailService: EmailServiceInterface;
  mailgunApiKey: string | undefined;
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

    // Try to send notification email first
    let emailSent = false;
    let warning: string | undefined;

    if (mailgunApiKey) {
      try {
        const emailMessage = buildDoulaMatchNotification(formData);
        await emailService.sendEmail(
          { message: emailMessage, mailgunApiKey },
          logger,
        );
        emailSent = true;
      } catch (emailError: unknown) {
        logger.error("CRITICAL: Failed to send doula match notification email", {
          errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
          severity: "CRITICAL",
          error: emailError,
          errorMessage:
            emailError instanceof Error ? emailError.message : "Unknown error",
          errorStack:
            emailError instanceof Error ? emailError.stack : undefined,
          // Include form context for debugging
          formType: "doula_match",
          submitterEmail: formData.email,
          submitterName: formData.name,
          recaptchaScore: verification.score,
          timestamp: new Date().toISOString(),
        });

        // TODO: Implement admin notification mechanism
        // await sendAdminAlert({
        //   subject: "CRITICAL: Doula match form email failed",
        //   message: `Email sending failed for doula match form from ${formData.email}`,
        //   error: emailError
        // });

        warning = "Form saved but notification email failed to send";
      }
    } else {
      logger.error("CRITICAL: Mailgun API key not configured", {
        errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
        severity: "CRITICAL",
        formType: "doula_match",
        environment: process.env.NODE_ENV,
      });

      // TODO: Implement admin notification mechanism for config errors

      warning = "Form saved but notification email not configured";
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
    return {
      success: true,
      message: "Form submitted successfully",
      emailSent,
      ...(warning && { warning }),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { success: false, error: error.message };
    }

    logger.error("Failed to process doula match form", {
      errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    set.status = 500;
    return { success: false, error: "Internal server error" };
  }
}
