import { logger } from "firebase-functions/v2";
import {
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";
import Mailgun from "mailgun.js";
import { MARK_EMAIL, REFERRAL_EMAIL } from "../constants";
import { DoulaMatchFormDocument } from "./types";

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
  } = snapshot.data() as DoulaMatchFormDocument;

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: apiKey ?? "",
  });

  await mg.messages.create("mg.doulacooperative.com", {
    from: "Doula Cooperative <noreply@mg.doulacooperative.com>",
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
      <p><strong>Birth Location:</strong> ${birthLocation}</p>
      <p><strong>Other Info:</strong></p>
      <p>${otherInfo}</p>
    `,
    "h:Reply-To": email,
  });

  await snapshot.ref.update({ sent: true });
}
