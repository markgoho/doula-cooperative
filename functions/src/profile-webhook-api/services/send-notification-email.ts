import { MARK_EMAIL, NO_REPLY_EMAIL } from "../../constants/index.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  NotificationParameters,
  ProfileNotificationType,
} from "./types.js";

/**
 * Determine email content for a supported profile notification type.
 */
function getEmailContent(notificationType: ProfileNotificationType): {
  subject: string;
  heading: string;
  description: string;
} {
  const emailContentByType: Record<
    ProfileNotificationType,
    { subject: string; heading: string; description: string }
  > = {
    publish: {
      subject: "Your profile is now live",
      heading: "Your profile is now live!",
      description:
        "Your public doula profile on the Rochester Doula Cooperative website has been published and is now live.",
    },
    update: {
      subject: "Your Doula Cooperative profile has been updated",
      heading: "Your profile has been updated!",
      description:
        "Your public doula profile on the Rochester Doula Cooperative website has been successfully updated and is now live.",
    },
    "image-update": {
      subject: "Your profile photo has been updated",
      heading: "Your profile photo has been updated!",
      description:
        "Your profile photo on the Rochester Doula Cooperative website has been successfully updated and is now live.",
    },
    "image-delete": {
      subject: "Your profile photo has been removed",
      heading: "Your profile photo has been removed",
      description:
        "Your profile photo on the Rochester Doula Cooperative website has been successfully removed. Your profile is still active and visible without a photo.",
    },
  };

  return emailContentByType[notificationType];
}

/**
 * Send a member notification email for publish, update, image-update,
 * or image-delete profile events.
 *
 * @param params - Notification parameters
 * @throws Error if email fails to send
 */
export async function sendNotificationEmail({
  memberEmail,
  memberName,
  slug,
  notificationType,
  emailService,
  logger,
}: NotificationParameters & {
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  const profileUrl = `https://doulacooperative.com/doulas/${slug}/`;
  const { subject, heading, description } = getEmailContent(notificationType);

  const emailMessage: EmailMessage = {
    from: `Rochester Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: memberEmail,
    bcc: [MARK_EMAIL],
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #2c5282; margin-top: 0;">${heading}</h2>

    <p>Hello${memberName ? ` ${memberName}` : ""},</p>

    <p>${description}</p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${profileUrl}"
         style="display: inline-block; background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        View Your Profile
      </a>
    </p>

    <p style="font-size: 14px; color: #666;">
      If you did not make this update or notice any issues with your profile, please contact us at
      <a href="mailto:${MARK_EMAIL}" style="color: #4299e1;">${MARK_EMAIL}</a>.
    </p>
  </div>

  <p style="font-size: 12px; color: #999; text-align: center;">
    This is an automated notification from the Rochester Doula Cooperative.
  </p>
</body>
</html>`,
  };

  // Skip email in emulator mode
  if (process.env["FUNCTIONS_EMULATOR"]) {
    return;
  }

  await emailService.sendEmail({ message: emailMessage }, logger);
}
