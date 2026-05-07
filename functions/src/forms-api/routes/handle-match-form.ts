import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";
import { buildDoulaMatchNotification } from "../services/build-doula-match-notification.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { DoulaMatchData } from "../services/form-storage/types.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { runSpamChecks } from "../utils/run-spam-checks.js";
import { sendAndPersist } from "../utils/send-and-persist.js";

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

    const rejection = runSpamChecks({
      policy: {
        recaptcha: { score: verification.score },
      },
      submitterEmail: formData.email,
      submitterName: formData.name,
      formType: "doula match form",
      errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
      logger,
      set,
    });
    if (rejection !== undefined) {
      return rejection;
    }

    const { emailSent, warning } = await sendAndPersist({
      buildEmail: () => buildDoulaMatchNotification(formData),
      persist: ({ emailSent: sent }) =>
        formStorageService.saveMatchRequest({
          data: formData,
          recaptchaScore: verification.score,
          emailSent: sent,
        }),
      emailService,
      logger,
      formContext: {
        formType: "doula match form",
        formTypeKey: "doula_match",
        errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
        submitterEmail: formData.email,
        submitterName: formData.name,
        recaptchaScore: verification.score,
      },
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
