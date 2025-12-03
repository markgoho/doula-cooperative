import { getFirestore } from "firebase-admin/firestore";
import {
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/firestore";
import { logger } from "firebase-functions/v2";
import { type MailgunMessageData } from "mailgun.js/definitions";
import {
  MESSAGES_COLLECTION,
  type MessageDocument,
} from "../collections/index.js";
import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants/index.js";
import { sendEmail } from "../utils/send-email.js";

export async function handleDocumentCreated(
  event: FirestoreEvent<
    QueryDocumentSnapshot | undefined,
    { messageId: string }
  >,
  apiKey: string | undefined,
) {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const { contactName, email, message, recaptchaScore } =
    snapshot.data() as MessageDocument;

  // Only send email if score meets threshold
  if ((recaptchaScore ?? 0) < 0.5) {
    logger.info(`Skipping email for low-score message ${event.params.messageId}`, {
      email,
      score: recaptchaScore,
    });
    return;
  }

  const emailMessage: MailgunMessageData = {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: `New Contact Us Form Submission from ${contactName}`,
    html: `
    <p>Name: ${contactName}</p>
    <p>Email: ${email}</p>
    <p>Message: ${message}</p>
    `,
    "h:Reply-To": email,
  };

  try {
    if (process.env["FUNCTIONS_EMULATOR"]) {
      logger.info("Emulator detected, skipping email dispatch.");
    } else {
      await sendEmail(emailMessage, apiKey ?? "");
    }

    // Use collection constant and messageId from params to update document
    const firestore = getFirestore();
    const { messageId } = event.params;
    await firestore
      .collection(MESSAGES_COLLECTION)
      .doc(messageId)
      .update({ sent: true });

    logger.info(`Successfully processed contact form ${messageId}`);
  } catch (error) {
    logger.error("Error processing contact form:", error);
    // Don't throw - we don't want to retry email sends
    // The sent field will remain false, allowing manual intervention
  }
}
