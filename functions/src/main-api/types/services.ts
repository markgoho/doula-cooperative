import type { Logger } from "../../shared-api/types/logger.js";
import type { RecaptchaService } from "../services/recaptcha/index.js";
import type { FormStorageService } from "../services/form-storage/index.js";
import type { ProfileWebhookService } from "../services/profile-webhook/index.js";
import type { StripeWebhookService } from "../services/stripe-webhook/interface.js";

/**
 * Service keys used for dependency injection via Elysia's decorate.
 * Constants ensure consistency between registration and usage.
 */
export const SERVICE_KEYS = {
  RECAPTCHA_SERVICE: "recaptchaService",
  FORM_STORAGE_SERVICE: "formStorageService",
  PROFILE_WEBHOOK_SERVICE: "profileWebhookService",
  STRIPE_WEBHOOK_SERVICE: "stripeWebhookService",
  LOGGER: "logger",
} as const;

/**
 * Type for the services container.
 * Used in createApp() and route handler type signatures.
 */
export interface Services {
  [SERVICE_KEYS.RECAPTCHA_SERVICE]: typeof RecaptchaService;
  [SERVICE_KEYS.FORM_STORAGE_SERVICE]: typeof FormStorageService;
  [SERVICE_KEYS.PROFILE_WEBHOOK_SERVICE]: typeof ProfileWebhookService;
  [SERVICE_KEYS.STRIPE_WEBHOOK_SERVICE]: StripeWebhookService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

/**
 * Partial services for testing (all services optional).
 */
export type PartialServices = Partial<Services>;
