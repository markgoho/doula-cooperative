import { NO_REPLY_EMAIL } from "../../../constants/email-addresses.js";
import type { EmailMessage } from "../../../shared-api/services/email/index.js";
import { escapeHtml } from "../../../shared-api/utils/html-escape.js";

const ORGANIZATION_NAME = "Rochester Doula Cooperative";
const SUBJECT = `A doula from ${ORGANIZATION_NAME}`;

/** Strip characters that could break or inject into the From header. */
function toDisplayName(name: string): string {
  return name
    .replaceAll(/["<>\\]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function formatFrom(memberName: string): string {
  const displayName = toDisplayName(memberName);
  const label = displayName
    ? `${displayName} via Doula Cooperative`
    : "Doula Cooperative";
  return `"${label}" <${NO_REPLY_EMAIL}>`;
}

function toHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      paragraph => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("\n");
}

/**
 * Build a Member's Outreach email to a requester.
 *
 * From "‹Member› via Doula Cooperative" at the no-reply address, Reply-To the
 * Member, BCC the Member (their only copy of the message). The body is the
 * Member's own message, plus their Doula Profile link when published and the
 * message doesn't already include it.
 */
export function buildOutreachEmail({
  memberName,
  memberEmail,
  requesterEmail,
  message,
  profileUrl,
}: {
  memberName: string;
  memberEmail: string;
  requesterEmail: string;
  message: string;
  profileUrl: string | undefined;
}): EmailMessage {
  const body = message.trim();
  const profileLine =
    profileUrl && !body.includes(profileUrl)
      ? `Doula Profile: ${profileUrl}`
      : undefined;
  const footer = `You're receiving this because you asked the ${ORGANIZATION_NAME} to help you find a doula. Reply to this email to reach this doula directly.`;

  const text = [body, profileLine, `--\n${footer}`]
    .filter(Boolean)
    .join("\n\n");

  const profileHtml = profileUrl
    ? `<p>Doula Profile: <a href="${escapeHtml(profileUrl)}">${escapeHtml(profileUrl)}</a></p>`
    : "";
  const html = [
    toHtmlParagraphs(body),
    profileLine ? profileHtml : "",
    `<hr>\n<p style="color:#666;font-size:12px">${escapeHtml(footer)}</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    from: formatFrom(memberName),
    to: requesterEmail,
    bcc: memberEmail,
    "h:Reply-To": memberEmail,
    subject: SUBJECT,
    text,
    html,
  };
}
