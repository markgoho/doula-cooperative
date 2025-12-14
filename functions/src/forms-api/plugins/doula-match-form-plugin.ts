import { Elysia, t } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { EmailService } from "../../shared-api/services/email/index.js";
import { FormStorageService } from "../services/form-storage/index.js";
import { RecaptchaService } from "../services/recaptcha/index.js";
import { handleMatchFormLogic } from "../routes/handle-match-form.js";
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
        const mailgunApiKey = process.env["MAILGUN_API_KEY"];

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
          mailgunApiKey,
          logger,
          set,
        });
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 100 }),
          phone: t.String({ minLength: 1, maxLength: 20 }),
          email: t.String({ format: "email", maxLength: 255 }),
          zipcode: t.String({ minLength: 5, maxLength: 10 }),
          estimatedDueDate: t.Object({
            month: t.String({ minLength: 1, maxLength: 2 }),
            day: t.String({ minLength: 1, maxLength: 2 }),
            year: t.String({ minLength: 4, maxLength: 4 }),
          }),
          services: t.Array(t.String()),
          birthLocation: t.String({ minLength: 1, maxLength: 500 }),
          otherInfo: t.String({ maxLength: 5000 }),
          insurance: t.Array(t.String()),
          recaptchaToken: t.Optional(t.String()),
        }),
      },
    );
}
