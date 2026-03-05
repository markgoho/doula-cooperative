import { Timestamp } from "firebase-admin/firestore";
import { logger as firebaseLogger } from "firebase-functions/v2";
import type { Logger } from "../types/logger.js";
import { removeNewsletterSubscriber } from "./mailerlite.js";
import { updateMemberWithValidation } from "./firestore-helpers.js";

/**
 * Unsubscribe a member from the MailerLite newsletter as a non-critical action.
 *
 * Handles the common pattern of:
 *   1. Check MAILERLITE_API_KEY is configured
 *   2. Call removeNewsletterSubscriber
 *   3. Optionally update the member document (skip when the member doc will be deleted)
 *   4. On failure, log and push to failures array
 *
 * @returns true if unsubscribed, false if failed or skipped
 */
export async function unsubscribeNewsletter({
  email,
  memberId,
  action,
  errorId,
  failures,
  updateMemberDocument = true,
  logger = firebaseLogger,
}: {
  email: string;
  memberId: string;
  action: string;
  errorId: string;
  failures: string[];
  updateMemberDocument?: boolean;
  logger?: Logger;
}): Promise<boolean> {
  const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];
  if (!mailerliteApiKey) {
    logger.warn(
      "MAILERLITE_API_KEY not configured, skipping newsletter unsubscribe",
      { memberId, email },
    );
    failures.push(
      "Newsletter unsubscribe skipped: MAILERLITE_API_KEY not configured",
    );
    return false;
  }

  try {
    await removeNewsletterSubscriber({
      email,
      apiKey: mailerliteApiKey,
    });

    if (updateMemberDocument) {
      await updateMemberWithValidation({
        memberId,
        updates: {
          newsletterSubscribed: false,
          newsletterUnsubscribedAt: Timestamp.now(),
        },
        operation: "update member",
      });
    }

    logger.info(`Unsubscribed from newsletter after ${action}`, {
      memberId,
      email,
    });
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(
      `Failed to unsubscribe from newsletter during ${action}`,
      {
        errorId,
        memberId,
        email,
        error,
        errorMessage,
      },
    );
    failures.push(
      `Newsletter unsubscribe (${email}): ${errorMessage}`,
    );
    return false;
  }
}
