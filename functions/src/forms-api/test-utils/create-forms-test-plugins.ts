import { mock } from "bun:test";
import { createContactUsFormPlugin } from "../plugins/contact-us-form-plugin.js";
import { createDoulaMatchFormPlugin } from "../plugins/doula-match-form-plugin.js";
import type { EmailService } from "../../shared-api/services/email/interface.js";
import type { FormStorageService } from "../services/form-storage/interface.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";

/**
 * Creates the contact-us-form plugin with default mock services for testing.
 */
export function createContactUsFormTestPlugin(overrides?: {
  recaptchaService?: Partial<RecaptchaService>;
  formStorageService?: Partial<FormStorageService>;
  emailService?: Partial<EmailService>;
  logger?: Logger;
}) {
  const defaultRecaptchaService: RecaptchaService = {
    verifyToken: mock(() =>
      Promise.resolve({ success: true, score: 0.9 }),
    ),
    ...overrides?.recaptchaService,
  };

  const defaultFormStorageService: FormStorageService = {
    saveContactForm: mock(() => Promise.resolve()),
    saveMatchRequest: mock(() => Promise.resolve()),
    ...overrides?.formStorageService,
  };

  const defaultEmailService: EmailService = {
    sendEmail: mock(() => Promise.resolve()),
    ...overrides?.emailService,
  };

  return createContactUsFormPlugin({
    recaptchaService: defaultRecaptchaService,
    formStorageService: defaultFormStorageService,
    emailService: defaultEmailService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}

/**
 * Creates the doula-match-form plugin with default mock services for testing.
 */
export function createDoulaMatchFormTestPlugin(overrides?: {
  recaptchaService?: Partial<RecaptchaService>;
  formStorageService?: Partial<FormStorageService>;
  emailService?: EmailService;
  logger?: Logger;
}) {
  const defaultRecaptchaService: RecaptchaService = {
    verifyToken: mock(() =>
      Promise.resolve({ success: true, score: 0.9 }),
    ),
    ...overrides?.recaptchaService,
  };

  const defaultFormStorageService: FormStorageService = {
    saveContactForm: mock(() => Promise.resolve()),
    saveMatchRequest: mock(() => Promise.resolve()),
    ...overrides?.formStorageService,
  };

  const defaultEmailService: EmailService = {
    sendEmail: mock(() => Promise.resolve()),
    ...overrides?.emailService,
  };

  return createDoulaMatchFormPlugin({
    recaptchaService: defaultRecaptchaService,
    formStorageService: defaultFormStorageService,
    emailService: defaultEmailService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
