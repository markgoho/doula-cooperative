import { sendEmail } from "./send-email.js";

/**
 * Email service for sending emails via Mailgun.
 * Reads MAILGUN_API_KEY from environment at runtime.
 */
export const EmailService = {
  sendEmail,
};

// Re-export for convenience
export type { EmailService as EmailServiceInterface } from "./interface.js";
export { sendEmail } from "./send-email.js";
export type { EmailMessage } from "./types.js";
