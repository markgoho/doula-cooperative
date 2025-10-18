import { logger } from "firebase-functions/v2";
import Mailgun from "mailgun.js";
import type { MailgunMessageData } from "mailgun.js/definitions";
import { EMAIL_DOMAIN, ERROR_IDS } from "../constants";

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
    logger.error("Mailgun API call failed", {
      error,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_MAILGUN_FAILED,
      to: emailTo,
      subject: message.subject,
      domain: EMAIL_DOMAIN,
    });
    throw new Error(
      `Failed to send email via Mailgun to ${emailTo ?? "unknown recipient"}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
