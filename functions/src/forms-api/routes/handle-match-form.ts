import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { FormResponse } from "../schemas/form-response-schemas.js";
import { buildDoulaMatchNotification } from "../services/build-doula-match-notification.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { DoulaMatchData } from "../services/form-storage/types.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { processPublicFormIntake } from "../utils/process-public-form-intake.js";

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
  return processPublicFormIntake({
    recaptchaToken,
    recaptchaSecretKey,
    recaptchaService,
    emailService,
    logger,
    set,
    formContext: {
      formType: "doula match form",
      formTypeKey: "doula_match",
      errorId: ERROR_IDS.DOULA_MATCH_FORM_PROCESSING_FAILED,
      submitterEmail: formData.email,
      submitterName: formData.name,
    },
    getSpamPolicy: recaptchaScore => ({
      recaptcha: { score: recaptchaScore },
    }),
    buildEmail: () => buildDoulaMatchNotification(formData),
    persist: ({ emailSent, recaptchaScore }) =>
      formStorageService.saveMatchRequest({
        data: formData,
        recaptchaScore,
        emailSent,
      }),
  });
}
