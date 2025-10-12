import { getFirestore } from "firebase-admin/firestore";
import {
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/firestore";
import { logger } from "firebase-functions/v2";
import { MailgunMessageData } from "mailgun.js/definitions";
import { MARK_EMAIL, NO_REPLY_EMAIL, REFERRAL_EMAIL } from "../constants";
import { sendEmail } from "../utils/send-email";
import { type ContactUsFormDocument } from "./types";

export async function handleDocumentCreated(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined>,
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

  if (process.env.FUNCTIONS_EMULATOR) {
    logger.info("Emulator detected, skipping email dispatch.");
  } else {
    await sendEmail(emailMessage, apiKey ?? "");
  }

  // Use Admin SDK to update the document
  const firestore = getFirestore();
  await firestore.doc(snapshot.ref.path).update({ sent: true });
}
