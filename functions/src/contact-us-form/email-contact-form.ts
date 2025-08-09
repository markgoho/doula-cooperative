import {
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/firestore";
import Mailgun from "mailgun.js";
import { MARK_EMAIL, REFERRAL_EMAIL } from "../constants";
import { ContactUsFormDocument } from "./types";

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

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: apiKey ?? "",
  });

  await mg.messages.create("mg.doulacooperative.com", {
    from: "Doula Cooperative <noreply@mg.doulacooperative.com>",
    to: [MARK_EMAIL, REFERRAL_EMAIL],
    subject: "Hello",
    html: `
    <p>Name: ${contactName}</p>
    <p>Email: ${email}</p>
    <p>Message: ${message}</p>
    `,
    "h:Reply-To": email,
  });

  await snapshot.ref.update({ sent: true });
}
