import { type Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { MATCH_REQUESTS_COLLECTION } from "../collections/index.js";
import { type DoulaMatchFormRequest } from "./types.js";

export async function handleDoulaMatchForm(
  request: DoulaMatchFormRequest,
  response: Response,
  recaptchaSecretKey: string,
): Promise<void> {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "POST");
  response.set("Access-Control-Allow-Headers", "Content-Type");

  try {
    // Verify reCAPTCHA token
    const recaptchaToken = request.body.recaptchaToken ?? "";
    if (!recaptchaToken) {
      response.status(400).send({ error: "Missing reCAPTCHA token" });
      return;
    }

    const { verifyRecaptchaToken } =
      await import("../utils/recaptcha.js");
    const verification = await verifyRecaptchaToken(
      recaptchaToken,
      recaptchaSecretKey,
    );

    // Remove recaptchaToken from body before saving to Firestore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { recaptchaToken: _, ...formData } = request.body;

    const firestore = getFirestore();
    const today = new Date().toISOString();
    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      ...formData,
      submitted: today,
      sent: false,
      recaptchaScore: verification.score,
    });

    response.status(200).send("Okay");
  } catch (error: unknown) {
    logger.error(error);
    response.status(500).send({ error });
  }
}
