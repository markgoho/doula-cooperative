import { Response } from "express";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { DoulaMatchFormRequest } from "./types";

export async function handleDoulaMatchForm(
  request: DoulaMatchFormRequest,
  response: Response,
): Promise<void> {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "POST");
  response.set("Access-control-Allow-Headers", "Content-Type");

  try {
    const today = new Date().toISOString();
    await admin
      .firestore()
      .collection("matchRequests")
      .add({
        ...request.body,
        submitted: today,
      });

    response.status(200).send("Okay");
  } catch (error: unknown) {
    logger.error(error);
    response.status(500).send({ error });
  }
}
