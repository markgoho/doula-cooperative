import type { MatchRequestDocument } from "../../collections/match-requests.js";
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

/**
 * Build the No-Outreach Alert for one unanswered Referral.
 *
 * Carries the Referral Notification fields only (due month/year, services,
 * "City, ST", Spanish flag); the parameter type admits nothing else, so name,
 * contact details, notes, birth location and insurance cannot leak in.
 *
 * The subject is plain text and is not HTML-escaped.
 */
export function buildNoOutreachAlert({
  matchRequest: { zipcode, estimatedDueDate, services, locale },
  matchRequestId,
  daysSinceNotification,
}: {
  matchRequest: Pick<
    MatchRequestDocument,
    "zipcode" | "estimatedDueDate" | "services" | "locale"
  >;
  matchRequestId: string;
  daysSinceNotification: number;
}): EmailMessage {
  const dueMonth = formatDueMonth(estimatedDueDate);
  const area = formatZipArea(zipcode);
  const isSpanishPreferred = locale === "es";
  const detailUrl = `${ADMIN_APP_URL}/match-requests/${encodeURIComponent(matchRequestId)}`;
  const subjectSuffix = isSpanishPreferred ? " · Spanish" : "";
  const spanishLine = isSpanishPreferred
    ? "<p><strong>Requester prefers Spanish</strong></p>"
    : "";
  const dayLabel = daysSinceNotification === 1 ? "day" : "days";

  return {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: `No Outreach yet: due ${dueMonth} · ${area}${subjectSuffix}`,
    html: `
      <p>No Member has sent Outreach on this referral and no Offline Response has been recorded.</p>
      <p><strong>Referral Notification sent:</strong> ${escapeHtml(String(daysSinceNotification))} ${dayLabel} ago</p>
      <p><strong>Due:</strong> ${escapeHtml(dueMonth)}</p>
      <p><strong>Services:</strong> ${escapeHtml(services.join(", "))}</p>
      <p><strong>Area:</strong> ${escapeHtml(area)}</p>
      ${spanishLine}
      <p>The requester may have been contacted via Facebook.</p>
      <p><a href="${escapeHtml(detailUrl)}">View match request in the admin app</a></p>
    `,
  };
}
