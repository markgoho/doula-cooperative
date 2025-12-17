import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { StripeWebhookService } from "../services/interface.js";

/**
 * Service keys used for dependency injection via Elysia's decorate.
 * Constants ensure consistency between registration and usage.
 */
export const SERVICE_KEYS = {
  STRIPE_WEBHOOK_SERVICE: "stripeWebhookService",
  EMAIL_SERVICE: "emailService",
  LOGGER: "logger",
} as const;

/**
 * Type for the services container.
 * Used in createApp() and route handler type signatures.
 */
export interface Services {
  [SERVICE_KEYS.STRIPE_WEBHOOK_SERVICE]: StripeWebhookService;
  [SERVICE_KEYS.EMAIL_SERVICE]: EmailServiceInterface;
  [SERVICE_KEYS.LOGGER]: Logger;
}

/**
 * Partial services for testing (all services optional).
 */
export type PartialServices = Partial<Services>;
