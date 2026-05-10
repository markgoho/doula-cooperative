import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";
import { buildContactFormNotification } from "../services/build-contact-form-notification.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { ContactFormData } from "../services/form-storage/types.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { processPublicFormIntake } from "../utils/process-public-form-intake.js";

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
  return processPublicFormIntake({
    recaptchaToken,
    recaptchaSecretKey,
    recaptchaService,
    emailService,
    logger,
    set,
    formContext: {
      formType: "contact form",
      formTypeKey: "contact_form",
      errorId: ERROR_IDS.CONTACT_FORM_PROCESSING_FAILED,
      submitterEmail: formData.email,
      submitterName: formData.contactName,
    },
    getSpamPolicy: recaptchaScore => ({
      recaptcha: { score: recaptchaScore },
      honeypot: { value: honeypotValue },
      gibberish: [
        { fieldName: "contactName", text: formData.contactName },
        { fieldName: "message", text: formData.message },
      ],
      timing: { formLoadedAt, minMillis: 3000 },
    }),
    buildEmail: () => buildContactFormNotification(formData),
    persist: ({ emailSent, recaptchaScore }) =>
      formStorageService.saveContactForm({
        data: formData,
        recaptchaScore,
        emailSent,
      }),
  });
}
