import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../../../collections/index.js";
import {
  ERROR_IDS,
  NEWSLETTER_EMAIL,
  NO_REPLY_EMAIL,
} from "../../../constants/index.js";
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from "../../../shared-api/errors/http-error.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../../shared-api/services/email/index.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import { escapeHtml } from "../../../utils/html-escape.js";
import {
  addNewsletterSubscriber,
  removeNewsletterSubscriber,
} from "../../../utils/mailerlite.js";
import type { NewsletterService as NewsletterServiceInterface } from "./interface.js";

/**
 * Creates HTML for newsletter preference update failure notification email
 */
function createNewsletterFailureEmailHtml({
  email,
  name,
  uid,
  subscribed,
  errorMessage,
}: {
  email: string;
  name: string | undefined;
  uid: string;
  subscribed: boolean;
  errorMessage: string;
}): string {
  const action = subscribed ? "subscribe to" : "unsubscribe from";
  return `
    <h2>MailerLite Newsletter Update Failed</h2>
    <p>A member tried to ${action} the newsletter but the MailerLite API call failed.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Name:</strong> ${escapeHtml(name) || "Not provided"}</li>
      <li><strong>UID:</strong> ${escapeHtml(uid)}</li>
      <li><strong>Requested Action:</strong> ${subscribed ? "Subscribe" : "Unsubscribe"}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${escapeHtml(errorMessage)}</p>

    <p><strong>Action Required:</strong> Investigate the error and manually ${action} this member ${subscribed ? "to" : "from"} the MailerLite newsletter if needed.</p>
  `;
}

/**
 * Sends notification email when newsletter preference update fails
 */
async function sendFailureNotification({
  email,
  name,
  uid,
  subscribed,
  errorMessage,
  emailService,
  logger,
}: {
  email: string;
  name: string | undefined;
  uid: string;
  subscribed: boolean;
  errorMessage: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject: "Newsletter Update Failed - Action May Be Required",
      html: createNewsletterFailureEmailHtml({
        email,
        name,
        uid,
        subscribed,
        errorMessage,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent newsletter failure notification email", {
      uid,
      email,
      subscribed,
    });
  } catch (emailError) {
    logger.error(
      "CRITICAL: Failed to send newsletter failure notification email",
      {
        errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_NOTIFICATION_FAILED,
        uid,
        email,
        subscribed,
        error: emailError,
        severity: "CRITICAL",
        context: "MailerLite failed AND notification email failed",
        originalError: errorMessage,
      },
    );
  }
}

/**
 * Update newsletter preference for a member
 */
async function updateNewsletterPreference({
  memberId,
  subscribed,
  mailerliteApiKey,
  emailService,
  logger,
}: {
  memberId: string;
  subscribed: boolean;
  mailerliteApiKey: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<{ subscribed: boolean }> {
  const database = getFirestore();
  const memberReference = database.collection(MEMBERS_COLLECTION).doc(memberId);

  // 1. Get current member document
  let memberDocument: MemberDocument;
  let email: string;
  try {
    const documentSnapshot = await memberReference.get();
    if (!documentSnapshot.exists) {
      logger.warn("Member document not found", {
        errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_MEMBER_NOT_FOUND,
        memberId,
      });
      throw new NotFoundError(
        "Member document not found. Please contact support.",
      );
    }
    memberDocument = documentSnapshot.data() as MemberDocument;
    email = memberDocument.email;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    logger.error("Failed to read member document", {
      errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_FIRESTORE_READ_ERROR,
      memberId,
      error,
    });
    throw new HttpError("Failed to read member data. Please try again.", 500);
  }

  // 2. Check if change is needed (idempotent)
  if (memberDocument.newsletterSubscribed === subscribed) {
    logger.info("Newsletter preference already set to requested value", {
      memberId,
      email,
      subscribed,
    });
    return { subscribed };
  }

  // 3. Check if running in emulator - skip external API calls in test environment
  const isEmulator = Boolean(process.env["FUNCTIONS_EMULATOR"]);
  if (isEmulator) {
    logger.info(
      "Running in emulator - skipping MailerLite sync and updating Firestore directly",
      { memberId, email, subscribed },
    );

    // Update Firestore directly without syncing to MailerLite
    const updateData: Partial<MemberDocument> = {
      newsletterSubscribed: subscribed,
    };

    if (subscribed) {
      updateData.newsletterSubscribedAt = Timestamp.now();
    } else {
      updateData.newsletterUnsubscribedAt = Timestamp.now();
    }

    try {
      await memberReference.update(updateData);
      logger.info(
        "Updated member document with newsletter preference (emulator mode)",
        { memberId, email, subscribed },
      );
      return { subscribed };
    } catch (error) {
      logger.error("Failed to update member document in emulator", {
        errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_FIRESTORE_UPDATE_ERROR,
        memberId,
        email,
        subscribed,
        error,
      });
      throw new HttpError(
        "Failed to save newsletter preference. Please try again.",
        500,
      );
    }
  }

  // 4. Sync with MailerLite FIRST (source of truth for newsletter subscription)
  try {
    if (subscribed) {
      // Validate member has required subscription dates
      if (
        !memberDocument.subscriptionStart ||
        !memberDocument.membershipExpiresAt
      ) {
        const errorMessage = `Member document missing subscription dates (subscriptionStart: ${Boolean(memberDocument.subscriptionStart)}, membershipExpiresAt: ${Boolean(memberDocument.membershipExpiresAt)})`;

        logger.error(
          "Cannot subscribe to newsletter - missing subscription dates",
          {
            errorId:
              ERROR_IDS.UPDATE_NEWSLETTER_PREF_MISSING_SUBSCRIPTION_DATES,
            memberId,
            email,
            hasSubscriptionStart: Boolean(memberDocument.subscriptionStart),
            hasMembershipExpiresAt: Boolean(memberDocument.membershipExpiresAt),
            severity: "HIGH",
          },
        );

        // Send notification email
        await sendFailureNotification({
          email,
          name: memberDocument.name,
          uid: memberId,
          subscribed,
          errorMessage,
          emailService,
          logger,
        });

        throw new ValidationError(
          "Your account is missing required membership information. Please contact support.",
        );
      }

      // Subscribe to MailerLite
      await addNewsletterSubscriber({
        email,
        ...(memberDocument.name && { name: memberDocument.name }),
        subscriptionStart: memberDocument.subscriptionStart,
        membershipExpiresAt: memberDocument.membershipExpiresAt,
        ...(process.env["MAILERLITE_GROUP_ID"] && {
          groupId: process.env["MAILERLITE_GROUP_ID"],
        }),
        apiKey: mailerliteApiKey,
      });
      logger.info("Added subscriber to MailerLite", { memberId, email });
    } else {
      // Unsubscribe from MailerLite
      await removeNewsletterSubscriber({
        email,
        apiKey: mailerliteApiKey,
      });
      logger.info("Removed subscriber from MailerLite", { memberId, email });
    }
  } catch (error) {
    // If it's already an HttpError, rethrow it (notification already sent if needed)
    if (error instanceof HttpError) {
      throw error;
    }

    // MailerLite API error - log, send notification, and throw user-friendly error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error("Failed to sync newsletter preference to MailerLite", {
      errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_MAILERLITE_FAILED,
      memberId,
      email,
      subscribed,
      error,
    });

    // Send notification email
    await sendFailureNotification({
      email,
      name: memberDocument.name,
      uid: memberId,
      subscribed,
      errorMessage,
      emailService,
      logger,
    });

    throw new HttpError(
      "Failed to update newsletter subscription. Please try again later.",
      500,
    );
  }

  // 5. Update Firestore to cache the newsletter preference (production only)
  const updateData: Partial<MemberDocument> = {
    newsletterSubscribed: subscribed,
  };

  if (subscribed) {
    updateData.newsletterSubscribedAt = Timestamp.now();
  } else {
    updateData.newsletterUnsubscribedAt = Timestamp.now();
  }

  try {
    await memberReference.update(updateData);
    logger.info("Updated member document with newsletter preference", {
      memberId,
      email,
      subscribed,
    });
  } catch (error) {
    logger.error("Failed to update member document", {
      errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_FIRESTORE_UPDATE_ERROR,
      memberId,
      email,
      subscribed,
      error,
    });
    throw new HttpError(
      "Failed to save newsletter preference. Please try again.",
      500,
    );
  }

  return { subscribed };
}

export const NewsletterService: NewsletterServiceInterface = {
  updateNewsletterPreference,
};
