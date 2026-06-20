import Mailgun from "mailgun.js";
import { EMAIL_DOMAIN } from "../../../constants/email-domain.js";
import { ERROR_IDS, type ErrorId } from "../../../constants/error-ids.js";
import type { Logger } from "../../types/logger.js";
import { isEmulator } from "../../utils/is-emulator.js";
import {
  EmailAuthError,
  EmailDomainError,
  EmailInvalidRecipientError,
  EmailNetworkError,
  EmailRateLimitError,
  parseMailgunError,
} from "./errors.js";
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
  // Read API key from environment
  const mailgunApiKey = process.env["MAILGUN_API_KEY"];
  if (!mailgunApiKey) {
    const error = new Error(
      "MAILGUN_API_KEY environment variable not configured",
    );
    logger.error("Email service not configured", {
      errorId: ERROR_IDS.MAILGUN_AUTH_FAILED,
      error,
    });
    throw error;
  }

  // Skip email sending in emulator environment
  if (isEmulator()) {
    logger.info("Emulator detected, skipping email send", {
      to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
      subject: message.subject,
    });
    return;
  }

  try {
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: mailgunApiKey,
    });
    await mg.messages.create(EMAIL_DOMAIN, message);
  } catch (error) {
    const emailTo = Array.isArray(message.to)
      ? message.to.join(", ")
      : (message.to ?? "unknown");

    // Parse error into typed email error
    const emailError = parseMailgunError(error, emailTo);

    // Determine specific error ID based on error type
    let errorId: ErrorId = ERROR_IDS.STRIPE_WEBHOOK_MAILGUN_FAILED;
    if (emailError instanceof EmailAuthError) {
      errorId = ERROR_IDS.MAILGUN_AUTH_FAILED;
    } else if (emailError instanceof EmailDomainError) {
      errorId = ERROR_IDS.MAILGUN_DOMAIN_NOT_CONFIGURED;
    } else if (emailError instanceof EmailRateLimitError) {
      errorId = ERROR_IDS.MAILGUN_RATE_LIMITED;
    } else if (emailError instanceof EmailInvalidRecipientError) {
      errorId = ERROR_IDS.MAILGUN_INVALID_RECIPIENT;
    } else if (emailError instanceof EmailNetworkError) {
      errorId = ERROR_IDS.MAILGUN_NETWORK_ERROR;
    }

    logger.error("Mailgun API call failed", {
      error,
      errorId,
      retryable: emailError.isRetryable,
      to: emailTo,
      subject: message.subject,
      domain: EMAIL_DOMAIN,
    });

    throw emailError;
  }
}
