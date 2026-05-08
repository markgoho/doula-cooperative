import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { EmailMessage } from "../../shared-api/services/email/types.js";
import type { Logger } from "../../shared-api/types/logger.js";

const EMAIL_FAILURE_WARNING =
  "Form saved but notification email failed to send";

type SendAndPersistResult =
  | { emailSent: true; warning: undefined }
  | { emailSent: false; warning: string };

export async function sendAndPersist({
  buildEmail,
  persist,
  emailService,
  logger,
  formContext,
}: {
  buildEmail: () => EmailMessage;
  // persist must be idempotent: it may be invoked again on retry after a
  // transient Firestore failure with the same { emailSent } value.
  persist: (options: { emailSent: boolean }) => Promise<void>;
  emailService: EmailServiceInterface;
  logger: Logger;
  formContext: {
    formType: string;
    formTypeKey: string;
    errorId: string;
    submitterEmail: string;
    submitterName: string;
    recaptchaScore: number;
  };
}): Promise<SendAndPersistResult> {
  let result: SendAndPersistResult;

  try {
    const emailMessage = buildEmail();
    await emailService.sendEmail({ message: emailMessage }, logger);
    result = { emailSent: true, warning: undefined };
  } catch (emailError: unknown) {
    logger.error(
      `CRITICAL: Failed to send ${formContext.formType} notification email`,
      {
        errorId: formContext.errorId,
        severity: "CRITICAL",
        error: emailError,
        errorMessage:
          emailError instanceof Error ? emailError.message : "Unknown error",
        errorStack: emailError instanceof Error ? emailError.stack : undefined,
        formType: formContext.formTypeKey,
        submitterEmail: formContext.submitterEmail,
        submitterName: formContext.submitterName,
        recaptchaScore: formContext.recaptchaScore,
        timestamp: new Date().toISOString(),
      },
    );
    result = { emailSent: false, warning: EMAIL_FAILURE_WARNING };
  }

  try {
    await persist({ emailSent: result.emailSent });
  } catch (persistError: unknown) {
    if (result.emailSent) {
      logger.error(
        `CRITICAL: ${formContext.formType} email sent but Firestore persist failed`,
        {
          errorId: formContext.errorId,
          severity: "CRITICAL",
          emailSent: true,
          persistFailed: true,
          error: persistError,
          errorMessage:
            persistError instanceof Error
              ? persistError.message
              : "Unknown error",
          errorStack:
            persistError instanceof Error ? persistError.stack : undefined,
          formType: formContext.formTypeKey,
          submitterEmail: formContext.submitterEmail,
          submitterName: formContext.submitterName,
          recaptchaScore: formContext.recaptchaScore,
          timestamp: new Date().toISOString(),
        },
      );
    }
    throw persistError;
  }

  return result;
}
