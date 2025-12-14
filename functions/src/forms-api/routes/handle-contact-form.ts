import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  ContactFormData,
  FormStorageService,
} from "../services/form-storage/index.js";
import type { RecaptchaService } from "../services/recaptcha/index.js";

export async function handleContactFormLogic({
  formData,
  recaptchaToken,
  recaptchaSecretKey,
  recaptchaService,
  formStorageService,
  logger,
  set,
}: {
  formData: ContactFormData;
  recaptchaToken: string;
  recaptchaSecretKey: string;
  recaptchaService: typeof RecaptchaService;
  formStorageService: typeof FormStorageService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<{ success: boolean; message?: string; error?: string }> {
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

    // Save form to Firestore
    await formStorageService.saveContactForm({
      data: formData,
      recaptchaScore: verification.score,
    });

    logger.info("Contact form submitted successfully", {
      email: formData.email,
      recaptchaScore: verification.score,
    });

    set.status = 200;
    return { success: true, message: "Form submitted successfully" };
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
