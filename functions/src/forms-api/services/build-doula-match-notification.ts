import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "@doula-coop/functions-shared/constants/email-addresses.js";
import type { EmailMessage } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { DoulaMatchData } from "./form-storage/types.js";

/**
 * Build email notification message for doula match form submissions.
 *
 * Sends notification to admin emails with form details and sets Reply-To
 * to the submitter's email for easy response.
 *
 * SECURITY NOTE: This function does NOT escape HTML in form fields.
 * This is acceptable ONLY because emails are sent exclusively to trusted
 * admin recipients (MARK_EMAIL, REFERRAL_EMAIL). These recipients can safely
 * view HTML content from untrusted sources.
 *
 * If the recipient list EVER changes to include non-admin users (e.g., sending
 * confirmation emails to form submitters), HTML escaping MUST be implemented
 * before deploying to production to prevent XSS attacks.
 *
 * @param parameters - Doula match form data
 * @returns Email message ready to send via EmailService
 */
export function buildDoulaMatchNotification({
  name,
  phone,
  email,
  zipcode,
  estimatedDueDate,
  services,
  birthLocation,
  otherInfo,
  insurance,
}: DoulaMatchData): EmailMessage {
  return {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: `New Doula Match Request from ${name}`,
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>ZIP Code:</strong> ${zipcode}</p>
      <p><strong>Estimated Due Date:</strong> ${estimatedDueDate.month}/${estimatedDueDate.day}/${estimatedDueDate.year}</p>
      <p><strong>Services:</strong> ${services.join(", ")}</p>
      ${
        insurance.length > 0
          ? `<p><strong>Insurance/Cost offset:</strong> ${insurance.join(", ")}</p>`
          : ""
      }
      <p><strong>Birth Location:</strong> ${birthLocation}</p>
      <p><strong>Other Info:</strong></p>
      <p>${otherInfo}</p>
    `,
    "h:Reply-To": email,
  };
}
