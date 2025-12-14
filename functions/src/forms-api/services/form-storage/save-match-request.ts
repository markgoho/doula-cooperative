import { getFirestore } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../../collections/match-requests.js";
import type { DoulaMatchData } from "./types.js";

/**
 * Save a doula match request submission to Firestore.
 *
 * @param data - The doula match request data
 * @param recaptchaScore - The reCAPTCHA verification score
 */
export async function saveMatchRequest({
  data,
  recaptchaScore,
}: {
  data: DoulaMatchData;
  recaptchaScore: number;
}): Promise<void> {
  const firestore = getFirestore();
  const today = new Date().toISOString();

  await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
    ...data,
    submitted: today,
    sent: false,
    recaptchaScore,
  });
}
