import { logger } from "firebase-functions/v2";
import Mailgun from "mailgun.js";
import type { MailgunMessageData } from "mailgun.js/definitions";
import { EMAIL_DOMAIN, ERROR_IDS, type ErrorId } from "../constants/index.js";

export async function sendEmail(
  message: MailgunMessageData,
  apiKey: string,
): Promise<void> {
  try {
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: "api",
      key: apiKey,
    });
    await mg.messages.create(EMAIL_DOMAIN, message);
  } catch (error) {
    const emailTo = Array.isArray(message.to)
      ? message.to.join(", ")
      : message.to;

    // Parse Mailgun-specific errors
    let specificErrorId: ErrorId = ERROR_IDS.STRIPE_WEBHOOK_MAILGUN_FAILED;
    let retryable = false;

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes("unauthorized") || errorMessage.includes("forbidden")) {
        specificErrorId = ERROR_IDS.MAILGUN_AUTH_FAILED;
      } else if (errorMessage.includes("not found") || errorMessage.includes("domain")) {
        specificErrorId = ERROR_IDS.MAILGUN_DOMAIN_NOT_CONFIGURED;
      } else if (errorMessage.includes("rate limit")) {
        specificErrorId = ERROR_IDS.MAILGUN_RATE_LIMITED;
        retryable = true;
      } else if (errorMessage.includes("invalid") || errorMessage.includes("recipient")) {
        specificErrorId = ERROR_IDS.MAILGUN_INVALID_RECIPIENT;
      } else if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("network") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("enotfound")
      ) {
        specificErrorId = ERROR_IDS.MAILGUN_NETWORK_ERROR;
        retryable = true;
      }
    }

    logger.error("Mailgun API call failed", {
      error,
      errorId: specificErrorId,
      retryable,
      to: emailTo,
      subject: message.subject,
      domain: EMAIL_DOMAIN,
    });

    throw new Error(
      `Failed to send email via Mailgun to ${emailTo ?? "unknown recipient"}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
