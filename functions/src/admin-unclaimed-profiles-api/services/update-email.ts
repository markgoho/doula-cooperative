import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION } from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/index.js";
import {
  ConflictError,
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";

interface UpdateEmailOptions {
  oldEmail: string;
  newEmail: string;
  logger: Logger;
}

/**
 * Update the email address on an unclaimed profile.
 *
 * This moves the Firestore document to a new email (new doc ID).
 */
export async function updateEmail({
  oldEmail,
  newEmail,
  logger,
}: UpdateEmailOptions): Promise<{ success: true }> {
  if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
    logger.error("Old and new email addresses are the same", {
      errorId: ERROR_IDS.ADMIN_UPDATE_EMAIL_INVALID_EMAIL,
      oldEmail,
      newEmail,
    });
    throw new HttpError(
      "New email address must be different from the current email.",
      400,
    );
  }

  const firestore = getFirestore();

  const oldProfileReference = firestore
    .collection(IMPORT_COLLECTION)
    .doc(oldEmail);
  const oldProfileDocument = await oldProfileReference.get();

  if (!oldProfileDocument.exists) {
    logger.error("Unclaimed profile not found for email update", {
      errorId: ERROR_IDS.ADMIN_UPDATE_EMAIL_PROFILE_NOT_FOUND,
      oldEmail,
    });
    throw new NotFoundError(
      `Unclaimed profile with email ${oldEmail} not found.`,
    );
  }

  const oldProfileData = oldProfileDocument.data() as Record<string, unknown>;

  const newProfileReference = firestore
    .collection(IMPORT_COLLECTION)
    .doc(newEmail);
  const newProfileDocument = await newProfileReference.get();

  if (newProfileDocument.exists) {
    logger.error("New email already exists as unclaimed profile", {
      errorId: ERROR_IDS.ADMIN_UPDATE_EMAIL_NEW_EMAIL_EXISTS,
      oldEmail,
      newEmail,
    });
    throw new ConflictError(
      `An unclaimed profile with email ${newEmail} already exists.`,
    );
  }

  try {
    await newProfileReference.set({
      ...oldProfileData,
      email: newEmail,
    });

    await oldProfileReference.delete();

    logger.info("Updated unclaimed profile email", {
      oldEmail,
      newEmail,
    });
  } catch (moveError) {
    logger.error("Failed to move unclaimed profile to new email", {
      errorId: ERROR_IDS.ADMIN_UPDATE_EMAIL_MOVE_FAILED,
      error: moveError,
      oldEmail,
      newEmail,
    });
    throw new HttpError(
      "Failed to update profile email address. Please try again.",
      500,
    );
  }

  return { success: true as const };
}
