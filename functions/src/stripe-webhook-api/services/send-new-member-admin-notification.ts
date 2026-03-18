import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION } from "../../collections/index.js";
import { ADMIN_EMAIL } from "../../constants/admin.js";
import {
  ERROR_IDS,
  MEMBERS_APP_URL,
  NO_REPLY_EMAIL,
} from "../../constants/index.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";

function createNewMemberAdminNotificationHtml({
  customerEmail,
  customerName,
  uid,
  legacyImportFound,
  adminUrl,
}: {
  customerEmail: string;
  customerName: string | null | undefined;
  uid: string;
  legacyImportFound: boolean;
  adminUrl: string;
}): string {
  const displayName = escapeHtml(customerName) || "Not provided";

  return `
    <h2>New Member Signup Requires Review</h2>
    <p>A brand-new member account was created through Stripe checkout.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Name:</strong> ${displayName}</li>
      <li><strong>Email:</strong> ${escapeHtml(customerEmail)}</li>
      <li><strong>UID:</strong> ${escapeHtml(uid)}</li>
      <li><strong>Legacy Import Record Found:</strong> ${legacyImportFound ? "Yes" : "No"}</li>
      <li><strong>Admin Member Detail:</strong> <a href="${adminUrl}">${adminUrl}</a></li>
    </ul>

    <p><strong>Action:</strong> Open the member detail page and use <strong>Link Existing Profile</strong> if this member still needs their legacy profile associated.</p>
  `;
}

export async function sendNewMemberAdminNotification({
  emailService,
  customerEmail,
  customerName,
  uid,
  logger,
}: {
  emailService: EmailServiceInterface;
  customerEmail: string;
  customerName: string | null | undefined;
  uid: string;
  logger: Logger;
}): Promise<void> {
  try {
    let legacyImportFound = false;

    try {
      const importDocument = await getFirestore()
        .collection(IMPORT_COLLECTION)
        .doc(customerEmail)
        .get();
      legacyImportFound = importDocument.exists;
    } catch (error: unknown) {
      logger.error(
        "Failed to read legacy import record for new-member admin notification",
        {
          error,
          errorId:
            ERROR_IDS.STRIPE_WEBHOOK_NEW_MEMBER_ADMIN_NOTIFICATION_FAILED,
          uid,
          email: customerEmail,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
          severity: "CRITICAL",
          actionRequired:
            "Check Firestore access for legacy import lookups; admin notification sent without import status",
        },
      );
    }

    const adminUrl = `${MEMBERS_APP_URL}/admin/members/${escapeHtml(uid)}`;

    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `New Member Signup: ${customerEmail}`,
      html: createNewMemberAdminNotificationHtml({
        customerEmail,
        customerName,
        uid,
        legacyImportFound,
        adminUrl,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent new-member admin notification email", {
      uid,
      email: customerEmail,
      legacyImportFound,
    });
  } catch (error: unknown) {
    logger.error("Failed to send new-member admin notification email", {
      error,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_NEW_MEMBER_ADMIN_NOTIFICATION_FAILED,
      uid,
      email: customerEmail,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      severity: "CRITICAL",
      actionRequired:
        "Review new member signups manually until admin notifications are restored",
    });
  }
}
