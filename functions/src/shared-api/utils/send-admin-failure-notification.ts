import { logger as firebaseLogger } from "firebase-functions/v2";
import { NEWSLETTER_EMAIL, NO_REPLY_EMAIL } from "../../constants/index.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../services/email/index.js";
import type { Logger } from "../types/logger.js";
import { escapeHtml } from "./html-escape.js";

/**
 * Build standard HTML for cascading failure notification emails sent to admin.
 *
 * All failure notifications follow the same structure:
 *   - Title and description
 *   - Member details (email, memberId)
 *   - List of failed actions
 *   - Action required prompt
 */
export function buildFailureNotificationHtml({
  title,
  description,
  email,
  memberId,
  failures,
}: {
  title: string;
  description: string;
  email: string;
  memberId: string;
  failures: string[];
}): string {
  const failureItems = failures
    .map(failure => `<li>${escapeHtml(failure)}</li>`)
    .join("\n");

  return `
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(description)}</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Member ID:</strong> ${escapeHtml(memberId)}</li>
    </ul>

    <h3>Failed Actions:</h3>
    <ul>
      ${failureItems}
    </ul>

    <p><strong>Action Required:</strong> Please manually complete the failed actions above.</p>
  `;
}

/**
 * Send an admin notification email when cascading actions fail.
 *
 * Used by subscription-end, refund, and clean-slate-delete flows when
 * non-critical follow-up actions (draft profile, unsubscribe newsletter, etc.) fail.
 * Logs a CRITICAL error if the notification email itself fails to send.
 */
export async function sendAdminFailureNotification({
  subject,
  title,
  description,
  email,
  memberId,
  failures,
  errorId,
  emailService,
  logger = firebaseLogger,
}: {
  subject: string;
  title: string;
  description: string;
  email: string;
  memberId: string;
  failures: string[];
  errorId: string;
  emailService: EmailServiceInterface;
  logger?: Logger;
}): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject,
      html: buildFailureNotificationHtml({
        title,
        description,
        email,
        memberId,
        failures,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent failure notification email", { memberId });
  } catch (emailError) {
    logger.error("CRITICAL: Failed to send failure notification email", {
      errorId,
      memberId,
      error: emailError,
      severity: "CRITICAL",
      context: "Cascading actions failed AND notification email failed",
      failures,
    });
  }
}
