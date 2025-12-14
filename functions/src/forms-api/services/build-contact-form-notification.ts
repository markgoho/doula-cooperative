import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../../constants/email-addresses.js";
import type { EmailMessage } from "../../shared-api/services/email/index.js";
import type { ContactFormData } from "./form-storage/index.js";

/**
 * Build email notification message for contact form submissions.
 *
 * Sends notification to admin emails with form details and sets Reply-To
 * to the submitter's email for easy response.
 *
 * @param parameters - Contact form data
 * @param parameters.contactName - Name of person submitting form
 * @param parameters.email - Email address of person submitting form
 * @param parameters.message - Message content from form
 * @returns Email message ready to send via EmailService
 */
export function buildContactFormNotification({
  contactName,
  email,
  message,
}: ContactFormData): EmailMessage {
  const emailMessage: EmailMessage = {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: `New Contact Us Form Submission from ${contactName}`,
    html: `
      <p><strong>Name:</strong> ${contactName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `,
    "h:Reply-To": email,
  };
  return emailMessage;
}
