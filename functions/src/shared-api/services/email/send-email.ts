import type { Logger } from "../../types/logger.js";
import { sendMailgunMessage } from "./send-mailgun-message.js";
import type { EmailMessage } from "./types.js";

/**
 * Send an email via Mailgun.
 *
 * Reads MAILGUN_API_KEY from environment variables.
 * Automatically skips sending in emulator environment (logs instead).
 *
 * @param parameters - Email message data
 * @param parameters.message - Email message data (to, from, subject, html/text, etc.)
 * @param logger - Logger instance for error reporting
 * @throws Error if MAILGUN_API_KEY is not configured
 * @throws Error if email sending fails (but not in emulator environment)
 */
export async function sendEmail(
  { message }: { message: EmailMessage },
  logger: Logger,
): Promise<void> {
  await sendMailgunMessage({ message }, logger);
}
