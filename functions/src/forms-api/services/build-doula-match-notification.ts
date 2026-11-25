import type { MatchRequestLocale } from "../../collections/match-request-locale.js";
import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../../constants/email-addresses.js";
import { ADMIN_APP_URL } from "../../constants/urls.js";
import type { EmailMessage } from "../../shared-api/services/email/index.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";
import type { DoulaMatchData } from "./form-storage/types.js";

const LOCALE_LABELS: Record<MatchRequestLocale, string> = {
  en: "English (en)",
  es: "Spanish (es)",
};

/**
 * Build the Match Request Notification sent to the admin and referral inboxes
 * for a new Match Request.
 *
 * Carries the full request, because the Referral Coordinator relays it to the
 * FB group from this email. Only `MARK_EMAIL` and `REFERRAL_EMAIL` receive it;
 * member-facing emails (Referral Notification, No-Outreach Alert) stay PHI-free.
 * Reply-To is the requester so either inbox can answer directly.
 *
 * SECURITY NOTE: every field is requester-supplied, so every value interpolated
 * into the HTML is escaped. The subject is plain text and is not HTML-escaped.
 *
 * @param parameters - Doula match form data and the pre-allocated Match Request id
 * @returns Email message ready to send via EmailService
 */
export function buildDoulaMatchNotification({
  data: {
    name,
    phone,
    email,
    zipcode,
    estimatedDueDate,
    services,
    birthLocation,
    otherInfo,
    insurance,
    locale,
  },
  matchRequestId,
}: {
  data: DoulaMatchData;
  matchRequestId: string;
}): EmailMessage {
  const localeLabel = locale ? LOCALE_LABELS[locale] : undefined;
  const dueDate = `${estimatedDueDate.month}/${estimatedDueDate.day}/${estimatedDueDate.year}`;
  const detailUrl = `${ADMIN_APP_URL}/match-requests/${encodeURIComponent(matchRequestId)}`;
  const insuranceLine =
    insurance.length > 0
      ? `<p><strong>Insurance/Cost offset:</strong> ${escapeHtml(insurance.join(", "))}</p>`
      : "";
  const languageLine = localeLabel
    ? `<p><strong>Language:</strong> ${escapeHtml(localeLabel)}</p>`
    : "";

  return {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: `New Doula Match Request from ${name}`,
    html: `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>ZIP Code:</strong> ${escapeHtml(zipcode)}</p>
      <p><strong>Estimated Due Date:</strong> ${escapeHtml(dueDate)}</p>
      <p><strong>Services:</strong> ${escapeHtml(services.join(", "))}</p>
      ${insuranceLine}
      <p><strong>Birth Location:</strong> ${escapeHtml(birthLocation)}</p>
      ${languageLine}
      <p><strong>Other Info:</strong></p>
      <p>${escapeHtml(otherInfo)}</p>
      <hr>
      <p><a href="${escapeHtml(detailUrl)}">View match request in the admin app</a></p>
    `,
    "h:Reply-To": email,
  };
}
