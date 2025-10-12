import Mailgun from "mailgun.js";
import type { MailgunMessageData } from "mailgun.js/definitions";
import { EMAIL_DOMAIN } from "../constants";

export async function sendEmail(
  message: MailgunMessageData,
  apiKey: string,
): Promise<void> {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: apiKey,
  });
  await mg.messages.create(EMAIL_DOMAIN, message);
}
