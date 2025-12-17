import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { buildContactFormNotification } from "../services/build-contact-form-notification.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { ContactFormData } from "../services/form-storage/types.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";

export interface FormResponse {
  success: boolean;
  message?: string;
  error?: string;
  emailSent?: boolean;
  warning?: string;
}

export async function handleContactFormLogic({
  formData,
  recaptchaToken,
  recaptchaSecretKey,
  recaptchaService,
  formStorageService,
  emailService,
  logger,
  set,
}: {
  formData: ContactFormData;
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
      logger.warn("reCAPTCHA verification failed for contact form", {
        errorId: ERROR_IDS.RECAPTCHA_VERIFICATION_FAILED,
        error: verification.error,
      });
      set.status = 400;
      return { success: false, error: "reCAPTCHA verification failed" };
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
        errorStack:
          emailError instanceof Error ? emailError.stack : undefined,
        // Include form context for debugging
        formType: "contact_form",
        submitterEmail: formData.email,
        submitterName: formData.contactName,
        recaptchaScore: verification.score,
        timestamp: new Date().toISOString(),
      });

      // TODO: Implement admin notification mechanism
      // await sendAdminAlert({
      //   subject: "CRITICAL: Contact form email failed",
      //   message: `Email sending failed for contact form from ${formData.email}`,
      //   error: emailError
      // });

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

    logger.error("Failed to process contact form", {
      errorId: ERROR_IDS.CONTACT_FORM_PROCESSING_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    set.status = 500;
    return { success: false, error: "Internal server error" };
  }
}
