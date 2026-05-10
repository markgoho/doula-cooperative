import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { EmailMessage } from "../../shared-api/services/email/types.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { runSpamChecks, type SpamPolicy } from "./run-spam-checks.js";
import { sendAndPersist } from "./send-and-persist.js";

export async function processPublicFormIntake({
  recaptchaToken,
  recaptchaSecretKey,
  recaptchaService,
  emailService,
  logger,
  set,
  formContext,
  getSpamPolicy,
  buildEmail,
  persist,
}: {
  recaptchaToken: string;
  recaptchaSecretKey: string;
  recaptchaService: RecaptchaService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
  formContext: {
    formType: string;
    formTypeKey: string;
    errorId: string;
    submitterEmail: string;
    submitterName: string;
  };
  getSpamPolicy: (recaptchaScore: number) => SpamPolicy;
  buildEmail: () => EmailMessage;
  persist: (options: { emailSent: boolean; recaptchaScore: number }) => Promise<void>;
}): Promise<FormResponse> {
  try {
    const verification = await recaptchaService.verifyToken({
      token: recaptchaToken,
      secretKey: recaptchaSecretKey,
      logger,
    });

    if (!verification.success) {
      logger.warn(`reCAPTCHA verification failed for ${formContext.formType}`, {
        errorId: ERROR_IDS.RECAPTCHA_VERIFICATION_FAILED,
        error: verification.error,
      });
      set.status = 400;
      return { success: false, error: "reCAPTCHA verification failed" };
    }

    const rejection = runSpamChecks({
      policy: getSpamPolicy(verification.score),
      submitterEmail: formContext.submitterEmail,
      submitterName: formContext.submitterName,
      formType: formContext.formType,
      errorId: formContext.errorId,
      logger,
      set,
    });
    if (rejection !== undefined) {
      return rejection;
    }

    const { emailSent, warning } = await sendAndPersist({
      buildEmail,
      persist: ({ emailSent: sent }) =>
        persist({ emailSent: sent, recaptchaScore: verification.score }),
      emailService,
      logger,
      formContext: {
        ...formContext,
        recaptchaScore: verification.score,
      },
    });

    logger.info(`${formContext.formType} submitted successfully`, {
      email: formContext.submitterEmail,
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

    logger.error(`Failed to process ${formContext.formType}`, {
      errorId: formContext.errorId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    set.status = 500;
    return { success: false, error: "Internal server error" };
  }
}
