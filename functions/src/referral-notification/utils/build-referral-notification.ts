import type { MatchRequestDocument } from "../../collections/match-requests.js";
import {
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../../constants/email-addresses.js";
import { MEMBERS_APP_URL } from "../../constants/urls.js";
import type { EmailMessage } from "../../shared-api/services/email/index.js";
import { formatDueMonth } from "../../shared-api/utils/format-due-month.js";
import { formatZipArea } from "../../shared-api/utils/format-zip-area.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";

/**
 * Build one Mailgun batch send of the Referral Notification.
 *
 * Only due month/year, services, "City, ST" and the Spanish flag leave the
 * platform; the parameter type admits nothing else, so name, contact details,
 * notes, birth location and insurance cannot leak in.
 *
 * `recipient-variables` holds one key per `to` address, which makes Mailgun
 * deliver a separate copy per recipient: each Member sees only their own To.
 *
 * The subject is plain text and is not HTML-escaped.
 */
export function buildReferralNotification({
  matchRequest: { zipcode, estimatedDueDate, services, locale },
  matchRequestId,
  recipientEmails,
}: {
  matchRequest: Pick<
    MatchRequestDocument,
    "zipcode" | "estimatedDueDate" | "services" | "locale"
  >;
  matchRequestId: string;
  recipientEmails: string[];
}): EmailMessage {
  const dueMonth = formatDueMonth(estimatedDueDate);
  const area = formatZipArea(zipcode);
  const isSpanishPreferred = locale === "es";
  const referralUrl = `${MEMBERS_APP_URL}/referrals/${encodeURIComponent(matchRequestId)}`;
  const membershipUrl = `${MEMBERS_APP_URL}/membership`;
  const subjectSuffix = isSpanishPreferred ? " · Spanish" : "";
  const spanishLine = isSpanishPreferred
    ? "<p><strong>Requester prefers Spanish</strong></p>"
    : "";
  const recipientVariables = Object.fromEntries(
    recipientEmails.map(email => [email, {}]),
  );

  return {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: recipientEmails,
    "h:Reply-To": REFERRAL_EMAIL,
    "recipient-variables": JSON.stringify(recipientVariables),
    subject: `New referral: due ${dueMonth} · ${area}${subjectSuffix}`,
    html: `
      <p>A new referral is waiting in the member portal.</p>
      <p><strong>Due:</strong> ${escapeHtml(dueMonth)}</p>
      <p><strong>Services:</strong> ${escapeHtml(services.join(", "))}</p>
      <p><strong>Area:</strong> ${escapeHtml(area)}</p>
      ${spanishLine}
      <p><a href="${escapeHtml(referralUrl)}">View referral</a></p>
      <hr>
      <p><small>You're getting this because you're a Doula Cooperative member. <a href="${escapeHtml(membershipUrl)}">Manage referral emails</a></small></p>
    `,
  };
}
