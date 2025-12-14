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
import type { SendEmailParameters } from "./types.js";

/**
 * Send an email via Mailgun.
 *
 * Automatically skips sending in emulator environment (logs instead).
 *
 * @param parameters - Email message and Mailgun API key
 * @param parameters.message - Email message data (to, from, subject, html/text, etc.)
 * @param parameters.mailgunApiKey - Mailgun API key for authentication
 * @param logger - Logger instance for error reporting
 * @throws Error if email sending fails (but not in emulator environment)
 */
export async function sendEmail(
  { message, mailgunApiKey }: SendEmailParameters,
  logger: Logger,
): Promise<void> {
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
      retryable: emailError.retryable,
      to: emailTo,
      subject: message.subject,
      domain: EMAIL_DOMAIN,
    });

    throw emailError;
  }
}
