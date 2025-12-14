import type { Logger } from "../../shared-api/types/logger.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import type { FormStorageService } from "../services/form-storage/interface.js";

/**
 * Service keys used for dependency injection via Elysia's decorate.
 * Constants ensure consistency between registration and usage.
 */
export const SERVICE_KEYS = {
  RECAPTCHA_SERVICE: "recaptchaService",
  FORM_STORAGE_SERVICE: "formStorageService",
  LOGGER: "logger",
} as const;

/**
 * Type for the services container.
 * Used in createApp() and route handler type signatures.
 * Services are now defined as interfaces for better testability and decoupling.
 */
export interface Services {
  [SERVICE_KEYS.RECAPTCHA_SERVICE]: RecaptchaService;
  [SERVICE_KEYS.FORM_STORAGE_SERVICE]: FormStorageService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

/**
 * Partial services for testing (all services optional).
 */
export type PartialServices = Partial<Services>;
