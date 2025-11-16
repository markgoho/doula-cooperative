import { getFirestore } from "firebase-admin/firestore";
import {
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/firestore";
import { logger } from "firebase-functions/v2";
import { type MailgunMessageData } from "mailgun.js/definitions";
import {
  MARK_EMAIL,
  MESSAGES_COLLECTION,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants/index.js";
import { sendEmail } from "../utils/send-email.js";
import { type ContactUsFormDocument } from "./types.js";

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

  const { contactName, email, message } =
    snapshot.data() as ContactUsFormDocument;

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
