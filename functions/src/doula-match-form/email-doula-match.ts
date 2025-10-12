import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";
import type { MailgunMessageData } from "mailgun.js/definitions";
import { MARK_EMAIL, NO_REPLY_EMAIL, REFERRAL_EMAIL } from "../constants";
import { sendEmail } from "../utils/send-email";
import { type DoulaMatchFormDocument } from "./types";

export async function handleDocumentCreated(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined>,
  apiKey: string | undefined,
) {
  const snapshot = event.data;
  if (!snapshot) {
    logger.info("No data associated with the event");
    return;
  }

  const {
    name,
    phone,
    email,
    zipcode,
    estimatedDueDate,
    services,
    birthLocation,
    otherInfo,
    insurance,
  } = snapshot.data() as DoulaMatchFormDocument;

  const emailMessage: MailgunMessageData = {
    from: `Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: `New Doula Match Request from ${name}`,
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Zipcode:</strong> ${zipcode}</p>
      <p><strong>Estimated Due Date:</strong> ${estimatedDueDate.month}/${
        estimatedDueDate.day
      }/${estimatedDueDate.year}</p>
      <p><strong>Services:</strong> ${services.join(", ")}</p>
      ${
        insurance.length > 0
          ? `<p><strong>Insurance/Cost offset:</strong> ${insurance.join(
              ", ",
            )}</p>`
          : ""
      }
      <p><strong>Birth Location:</strong> ${birthLocation}</p>
      <p><strong>Other Info:</strong></p>
      <p>${otherInfo}</p>
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
