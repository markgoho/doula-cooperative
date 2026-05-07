import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { EmailMessage } from "../../shared-api/services/email/types.js";
import type { Logger } from "../../shared-api/types/logger.js";

export async function sendAndPersist({
  buildEmail,
  persist,
  emailService,
  logger,
  formContext,
}: {
  buildEmail: () => EmailMessage;
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
}): Promise<{ emailSent: boolean; warning: string | undefined }> {
  let emailSent = false;
  let warning: string | undefined;

  try {
    const emailMessage = buildEmail();
    await emailService.sendEmail({ message: emailMessage }, logger);
    emailSent = true;
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
    warning = "Form saved but notification email failed to send";
  }

  await persist({ emailSent });

  return { emailSent, warning };
}
