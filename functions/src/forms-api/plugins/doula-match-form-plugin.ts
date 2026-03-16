import { EmailService } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { handleMatchFormLogic } from "../routes/handle-match-form.js";
import {
  DoulaMatchFormBodySchema,
  FormResponseSchema,
} from "../schemas/form-response-schemas.js";
import { FormStorageService } from "../services/form-storage/index.js";
import { RecaptchaService } from "../services/recaptcha/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create doula-match form plugin.
 *
 * This plugin handles doula match form submissions at POST /doula-match.
 * It verifies reCAPTCHA tokens and saves submissions to Firestore.
 *
 * Firebase rewrite: /api/forms/** → formsApi function
 * Plugin routes start from "/" - Firebase already provides /api/forms prefix
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with doula match form route
 */
export function createDoulaMatchFormPlugin(services?: PartialServices) {
  return new Elysia({ name: "doula-match-form" })
    .decorate(
      SERVICE_KEYS.RECAPTCHA_SERVICE,
      services?.recaptchaService ?? RecaptchaService,
    )
    .decorate(
      SERVICE_KEYS.FORM_STORAGE_SERVICE,
      services?.formStorageService ?? FormStorageService,
    )
    .decorate(
      SERVICE_KEYS.EMAIL_SERVICE,
      services?.emailService ?? EmailService,
    )
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .post(
      "/doula-match",
      async ({
        body,
        recaptchaService,
        formStorageService,
        emailService,
        logger,
        set,
      }) => {
        const recaptchaSecretKey = process.env["RECAPTCHA_SECRET_KEY"];
        if (!recaptchaSecretKey) {
          logger.error("RECAPTCHA_SECRET_KEY not configured");
          set.status = 500;
          return { success: false, error: "Server configuration error" };
        }

        const { recaptchaToken, ...formData } = body;

        if (!recaptchaToken) {
          set.status = 400;
          return { success: false, error: "Missing reCAPTCHA token" };
        }

        return handleMatchFormLogic({
          formData,
          recaptchaToken,
          recaptchaSecretKey,
          recaptchaService,
          formStorageService,
          emailService,
          logger,
          set,
        });
      },
      {
        body: DoulaMatchFormBodySchema,
        response: FormResponseSchema,
      },
    );
}
