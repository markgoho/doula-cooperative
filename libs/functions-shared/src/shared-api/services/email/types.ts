import type { MailgunMessageData } from "mailgun.js/definitions";

/**
 * Email message structure for sending emails.
 * Re-exports MailgunMessageData for type safety.
 */
export type EmailMessage = MailgunMessageData;
