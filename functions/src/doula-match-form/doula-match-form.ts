import { type Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { MATCH_REQUESTS_COLLECTION } from "../constants/index.js";
import { type DoulaMatchFormRequest } from "./types.js";

export async function handleDoulaMatchForm(
  request: DoulaMatchFormRequest,
  response: Response,
): Promise<void> {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "POST");
  response.set("Access-Control-Allow-Headers", "Content-Type");

  try {
    const firestore = getFirestore();
    const today = new Date().toISOString();
    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      ...request.body,
      submitted: today,
      sent: false,
    });

    response.status(200).send("Okay");
  } catch (error: unknown) {
    logger.error(error);
    response.status(500).send({ error });
  }
}
