import { MARK_EMAIL, NO_REPLY_EMAIL } from "../../constants/index.js";
import type { EmailMessage } from "../../shared-api/services/email/index.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";

/**
 * Builds a notification email sent to a member whose membership was refunded.
 * CC'd to the webmaster for record-keeping.
 */
export function buildRefundNotificationEmail({
  memberEmail,
  memberName,
}: {
  memberEmail: string;
  memberName?: string;
}): EmailMessage {
  const greeting =
    memberName !== undefined && memberName.length > 0
      ? `Dear ${escapeHtml(memberName)}`
      : "Hello";

  const html = `
    <h2>Membership Refund Confirmation</h2>
    <p>${greeting},</p>
    <p>Your Doula Cooperative membership has been refunded. Your payment has been returned and your membership is now inactive.</p>
    <p>If you have any questions, please contact us at <a href="mailto:${escapeHtml(MARK_EMAIL)}">${escapeHtml(MARK_EMAIL)}</a>.</p>
    <p>Thank you,<br>The Doula Cooperative</p>
  `;

  return {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: memberEmail,
    cc: MARK_EMAIL,
    subject: "Your Doula Cooperative Membership Refund",
    html,
  };
}
