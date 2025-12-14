import { sendEmail } from "./send-email.js";

/**
 * Email service for sending emails via Mailgun.
 * Provides a generic interface for all email operations.
 */
export const EmailService = {
  sendEmail,
};

// Re-export types and individual functions for direct imports
export { sendEmail } from "./send-email.js";
export type { EmailService as EmailServiceInterface } from "./interface.js";
export type { EmailMessage, SendEmailParameters } from "./types.js";
