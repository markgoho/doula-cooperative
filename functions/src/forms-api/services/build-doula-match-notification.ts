import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../../constants/email-addresses.js";
import { ADMIN_APP_URL } from "../../constants/urls.js";
import type { EmailMessage } from "../../shared-api/services/email/index.js";
import { formatDueMonth } from "../../shared-api/utils/format-due-month.js";
import { formatZipArea } from "../../shared-api/utils/format-zip-area.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";
import type { DoulaMatchData } from "./form-storage/types.js";

/**
 * Build the Match Request Notification sent to admins for a new Match Request.
 *
 * PHI stays in the platform: the email carries only due month/year, services,
 * a "City, ST" area, a Spanish flag, and a link to the admin match-request
 * detail page. It never includes the requester's name, contact details,
 * insurance, birth location, or notes, and sets no Reply-To.
 *
 * SECURITY NOTE: services and the ZIP fallback are still requester-supplied,
 * so every interpolated value is HTML-escaped. The subject is plain text and
 * is not HTML-escaped.
 *
 * @param parameters - Doula match form data and the pre-allocated Match Request id
 * @returns Email message ready to send via EmailService
 */
export function buildDoulaMatchNotification({
  data: { zipcode, estimatedDueDate, services, locale },
  matchRequestId,
}: {
  data: DoulaMatchData;
  matchRequestId: string;
}): EmailMessage {
  const dueMonth = formatDueMonth(estimatedDueDate);
  const area = formatZipArea(zipcode);
  const isSpanishPreferred = locale === "es";
  const detailUrl = `${ADMIN_APP_URL}/match-requests/${encodeURIComponent(matchRequestId)}`;
  const subjectSuffix = isSpanishPreferred ? " · Spanish" : "";
  const spanishLine = isSpanishPreferred
    ? "<p><strong>Requester prefers Spanish</strong></p>"
    : "";

  return {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: `New match request: due ${dueMonth} · ${area}${subjectSuffix}`,
    html: `
      <p><strong>Due:</strong> ${escapeHtml(dueMonth)}</p>
      <p><strong>Services:</strong> ${escapeHtml(services.join(", "))}</p>
      <p><strong>Area:</strong> ${escapeHtml(area)}</p>
      ${spanishLine}
      <p><a href="${escapeHtml(detailUrl)}">View match request in the admin app</a></p>
    `,
  };
}
