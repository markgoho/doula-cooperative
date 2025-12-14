import { Elysia, t } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { handleContactFormLogic } from "../routes/contact-us-form/handle-contact-form.js";
import { RecaptchaService } from "../services/recaptcha/index.js";
import { FormStorageService } from "../services/form-storage/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create contact-us form plugin.
 *
 * This plugin handles contact form submissions at POST /contact-us-form.
 * It verifies reCAPTCHA tokens and saves submissions to Firestore.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with contact form route
 */
export function createContactUsFormPlugin(services?: PartialServices) {
  return new Elysia({ name: "contact-us-form" })
    .decorate(
      SERVICE_KEYS.RECAPTCHA_SERVICE,
      services?.recaptchaService ?? RecaptchaService,
    )
    .decorate(
      SERVICE_KEYS.FORM_STORAGE_SERVICE,
      services?.formStorageService ?? FormStorageService,
    )
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .post(
      "/contact-us-form",
      async ({ body, recaptchaService, formStorageService, logger, set }) => {
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

        return handleContactFormLogic({
          formData,
          recaptchaToken,
          recaptchaSecretKey,
          recaptchaService,
          formStorageService,
          logger,
          set,
        });
      },
      {
        body: t.Object({
          contactName: t.String({ minLength: 1, maxLength: 100 }),
          email: t.String({ format: "email", maxLength: 255 }),
          message: t.String({ minLength: 1, maxLength: 5000 }),
          recaptchaToken: t.Optional(t.String()),
        }),
      },
    );
}
