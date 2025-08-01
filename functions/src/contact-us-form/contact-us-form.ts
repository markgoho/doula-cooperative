import { Response } from "express";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { Request } from "firebase-functions/v2/https";

interface ContactUsFormRequest extends Request {
  body: {
    contactName?: string;
    contactEmail: string;
    contactPhone: string;
    contactMessage: string;
  };
}

export async function handleContactUsForm(
  request: ContactUsFormRequest,
  response: Response,
): Promise<void> {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "POST");
  response.set("Access-Control-Allow-Headers", "Content-Type");

  try {
    const today = new Date().toISOString();
    await admin
      .firestore()
      .collection("messages")
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
