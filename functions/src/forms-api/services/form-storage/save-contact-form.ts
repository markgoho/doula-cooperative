import { getFirestore } from "firebase-admin/firestore";
import { MESSAGES_COLLECTION } from "../../../collections/messages.js";
import type { ContactFormData } from "./types.js";

/**
 * Save a contact form submission to Firestore.
 *
 * @param data - The contact form data
 * @param recaptchaScore - The reCAPTCHA verification score
 */
export async function saveContactForm({
  data,
  recaptchaScore,
}: {
  data: ContactFormData;
  recaptchaScore: number;
}): Promise<void> {
  const firestore = getFirestore();
  const today = new Date().toISOString();

  await firestore.collection(MESSAGES_COLLECTION).add({
    ...data,
    submitted: today,
    sent: false,
    recaptchaScore,
  });
}
