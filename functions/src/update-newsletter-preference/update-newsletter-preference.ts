import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import type { MailgunMessageData } from "mailgun.js/definitions";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../collections/index.js";
import {
  ERROR_IDS,
  NEWSLETTER_EMAIL,
  NO_REPLY_EMAIL,
} from "../constants/index.js";
import {
  addNewsletterSubscriber,
  removeNewsletterSubscriber,
} from "../utils/mailerlite.js";
import { sendEmail } from "../utils/send-email.js";

const mailerliteApiKey = defineSecret("MAILERLITE_API_KEY");
const mailgunApiKey = defineSecret("MAILGUN_API_KEY");

interface UpdateNewsletterPreferenceData {
  subscribed: boolean;
}

interface UpdateNewsletterPreferenceResult {
  success: boolean;
  subscribed: boolean;
}

/**
 * Creates HTML for newsletter preference update failure notification email
 */
function createNewsletterPreferenceFailureEmailHtml(
  email: string,
  name: string | undefined,
  uid: string,
  subscribed: boolean,
  errorMessage: string,
): string {
  const action = subscribed ? "subscribe to" : "unsubscribe from";
  return `
    <h2>MailerLite Newsletter Preference Update Failed</h2>
    <p>A member tried to ${action} the newsletter but the MailerLite API call failed.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Name:</strong> ${name ?? "Not provided"}</li>
      <li><strong>UID:</strong> ${uid}</li>
      <li><strong>Requested Action:</strong> ${subscribed ? "Subscribe" : "Unsubscribe"}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${errorMessage}</p>

    <p><strong>Action Required:</strong> Manually ${action} this member ${subscribed ? "to" : "from"} the MailerLite newsletter.</p>
    <p><strong>Note:</strong> The preference has been updated in Firestore, but MailerLite is out of sync.</p>
  `;
}

/**
 * Sends notification email when MailerLite preference update fails
 */
async function sendNewsletterPreferenceFailureNotification(parameters: {
  email: string;
  name: string | undefined;
  uid: string;
  subscribed: boolean;
  errorMessage: string;
  mailgunKey: string;
}): Promise<void> {
  const { email, name, uid, subscribed, errorMessage, mailgunKey } =
    parameters;

  try {
    const notificationEmail: MailgunMessageData = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject: "Action Required: Manual Newsletter Preference Update",
      html: createNewsletterPreferenceFailureEmailHtml(
        email,
        name,
        uid,
        subscribed,
        errorMessage,
      ),
    };

    await sendEmail(notificationEmail, mailgunKey);
    logger.info("Sent newsletter preference failure notification email", {
      uid,
      email,
      subscribed,
    });
  } catch (emailError) {
    logger.error(
      "Failed to send newsletter preference failure notification email",
      {
        errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_NOTIFICATION_FAILED,
        uid,
        email,
        subscribed,
        error: emailError,
      },
    );
  }
}

/**
 * Handles newsletter preference updates for authenticated members
 */
export async function handleUpdateNewsletterPreference(
  request: CallableRequest<UpdateNewsletterPreferenceData>,
): Promise<UpdateNewsletterPreferenceResult> {
  // 1. Check authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const { uid } = request.auth;
  const email = request.auth.token.email;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "Authentication token did not contain an email address.",
    );
  }

  // 2. Validate input
  const { subscribed } = request.data;

  if (typeof subscribed !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      'The "subscribed" parameter must be a boolean.',
    );
  }

  const database = getFirestore();
  const memberReference = database.collection(MEMBERS_COLLECTION).doc(uid);

  // 3. Get current member document
  let memberDocument: MemberDocument;
  try {
    const documentSnapshot = await memberReference.get();
    if (!documentSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Member document not found. Please contact support.",
      );
    }
    memberDocument = documentSnapshot.data() as MemberDocument;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to read member document", {
      errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_FIRESTORE_READ_ERROR,
      uid,
      email,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to read member data. Please try again.",
    );
  }

  // 4. Check if change is needed (idempotent)
  if (memberDocument.newsletterSubscribed === subscribed) {
    logger.info("Newsletter preference already set to requested value", {
      uid,
      email,
      subscribed,
    });
    return { success: true, subscribed };
  }

  // 5. Update Firestore FIRST (source of truth)
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
      uid,
      email,
      subscribed,
    });
  } catch (error) {
    logger.error("Failed to update member document", {
      errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_FIRESTORE_UPDATE_ERROR,
      uid,
      email,
      subscribed,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to update newsletter preference. Please try again.",
    );
  }

  // 6. Try to sync with MailerLite (non-blocking)
  if (mailerliteApiKey.value()) {
    try {
      if (subscribed) {
        // Subscribe to newsletter
        // Need subscription dates for MailerLite
        if (
          !memberDocument.subscriptionStart ||
          !memberDocument.membershipExpiresAt
        ) {
          logger.warn(
            "Cannot sync to MailerLite - missing subscription dates",
            {
              uid,
              email,
              hasSubscriptionStart: !!memberDocument.subscriptionStart,
              hasMembershipExpiresAt: !!memberDocument.membershipExpiresAt,
            },
          );
          // Don't fail - Firestore is already updated
          return { success: true, subscribed };
        }

        await addNewsletterSubscriber({
          email,
          ...(memberDocument.name && { name: memberDocument.name }),
          subscriptionStart: memberDocument.subscriptionStart,
          membershipExpiresAt: memberDocument.membershipExpiresAt,
          ...(process.env["MAILERLITE_GROUP_ID"] && {
            groupId: process.env["MAILERLITE_GROUP_ID"],
          }),
          apiKey: mailerliteApiKey.value(),
        });
        logger.info("Added subscriber to MailerLite", { uid, email });
      } else {
        // Unsubscribe from newsletter
        await removeNewsletterSubscriber({
          email,
          apiKey: mailerliteApiKey.value(),
        });
        logger.info("Removed subscriber from MailerLite", { uid, email });
      }
    } catch (mailerliteError) {
      // Log error and send notification but don't fail - Firestore is already updated
      const errorMessage =
        mailerliteError instanceof Error
          ? mailerliteError.message
          : "Unknown error";

      logger.error("Failed to sync newsletter preference to MailerLite", {
        errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_MAILERLITE_FAILED,
        uid,
        email,
        subscribed,
        error: mailerliteError,
      });

      // Send notification email if Mailgun is configured
      if (mailgunApiKey.value()) {
        await sendNewsletterPreferenceFailureNotification({
          email,
          name: memberDocument.name,
          uid,
          subscribed,
          errorMessage,
          mailgunKey: mailgunApiKey.value(),
        });
      }
    }
  }

  return { success: true, subscribed };
}
