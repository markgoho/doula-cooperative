import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION } from "../../collections/index.js";
import {
  LEGACY_RESPONSES_SUBCOLLECTION,
  type LegacyResponseDocument,
} from "../../collections/legacy-responses.js";
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
 * This moves the Firestore document to a new email (new doc ID), along with
 * every Offline Response recorded for it (`matchRequests/{id}/legacyResponses`
 * are keyed by this email), so a later link still carries them over.
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
  const newProfileReference = firestore
    .collection(IMPORT_COLLECTION)
    .doc(newEmail);

  try {
    // One transaction, so the import record and its Offline Responses never
    // end up under different emails.
    const movedResponses = await firestore.runTransaction(async transaction => {
      const oldProfileDocument = await transaction.get(oldProfileReference);
      if (!oldProfileDocument.exists) {
        logger.error("Unclaimed profile not found for email update", {
          errorId: ERROR_IDS.ADMIN_UPDATE_EMAIL_PROFILE_NOT_FOUND,
          oldEmail,
        });
        throw new NotFoundError(
          `Unclaimed profile with email ${oldEmail} not found.`,
        );
      }

      const newProfileDocument = await transaction.get(newProfileReference);
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

      const legacyResponses = await transaction.get(
        firestore
          .collectionGroup(LEGACY_RESPONSES_SUBCOLLECTION)
          .where("legacyEmail", "==", oldEmail),
      );
      const moves = legacyResponses.docs.map(legacyDocument => ({
        from: legacyDocument,
        to: legacyDocument.ref.parent.doc(newEmail),
      }));
      const existingTargets = await Promise.all(
        moves.map(({ to }) => transaction.get(to)),
      );

      const oldProfileData = oldProfileDocument.data() as Record<
        string,
        unknown
      >;
      transaction.set(newProfileReference, {
        ...oldProfileData,
        email: newEmail,
      });
      transaction.delete(oldProfileReference);

      for (const [index, { from, to }] of moves.entries()) {
        // A response already under the new email on that Referral wins.
        if (!existingTargets[index]?.exists) {
          const legacy = from.data() as LegacyResponseDocument;
          transaction.set(to, { ...legacy, legacyEmail: newEmail });
        }
        transaction.delete(from.ref);
      }
      return moves.length;
    });

    logger.info("Updated unclaimed profile email", {
      oldEmail,
      newEmail,
      movedResponses,
    });
  } catch (moveError) {
    if (moveError instanceof HttpError) throw moveError;
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
