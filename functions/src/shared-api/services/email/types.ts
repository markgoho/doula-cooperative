import type { MailgunMessageData } from "mailgun.js/definitions";

/**
 * Email message structure for sending emails.
 * Re-exports MailgunMessageData for type safety.
 */
export type EmailMessage = MailgunMessageData;

/**
 * Parameters for sending an email via the EmailService.
 */
export interface SendEmailParameters {
  message: EmailMessage;
  mailgunApiKey: string;
}
