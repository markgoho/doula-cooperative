import {
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/firestore";
import Mailgun from "mailgun.js";

export async function handleDocumentCreated(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined>,
  apiKey: string | undefined,
) {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const { contactName, email, message, submitted } = snapshot.data();

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: apiKey ?? "",
  });

  await mg.messages.create("mg.doulacooperative.com", {
    from: "Doula Cooperative <noreply@mg.doulacooperative.com>",
    to: ["markgoho@gmail.com"],
    subject: "Hello",
    html: `
    <p>Name: ${String(contactName)}</p>
    <p>Email: ${String(email)}</p>
    <p>Message: ${String(message)}</p>
    <p>Submitted: ${String(submitted)}</p>
    `,
  });

  await snapshot.ref.update({ sent: true });
}
