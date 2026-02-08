import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  MEMBERS_COLLECTION,
} from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/index.js";
import {
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { ChangeEmailAndResendSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";
import { sendInvitation } from "./send-invitation.js";

interface ChangeEmailAndResendOptions {
  oldEmail: string;
  newEmail: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}

/**
 * Change the email address on an unclaimed profile and resend the invitation.
 *
 * Flow:
 * 1. Validate the old unclaimed profile exists
 * 2. Check the new email doesn't already exist as an unclaimed profile
 * 3. Clean up the old invitation (delete Firebase Auth user + member document)
 * 4. Move the profile document to the new email (new doc ID)
 * 5. Call sendInvitation with the new email to create auth user + send email
 */
export async function changeEmailAndResend({
  oldEmail,
  newEmail,
  emailService,
  logger,
}: ChangeEmailAndResendOptions): Promise<ChangeEmailAndResendSuccessResponse> {
  if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
    logger.error("Old and new email addresses are the same", {
      errorId: ERROR_IDS.ADMIN_CHANGE_EMAIL_INVALID_EMAIL,
      oldEmail,
      newEmail,
    });
    throw new HttpError(
      "New email address must be different from the current email.",
      400,
    );
  }

  const firestore = getFirestore();
  const authentication = getAuth();

  const oldProfileReference = firestore
    .collection(IMPORT_COLLECTION)
    .doc(oldEmail);
  const oldProfileDocument = await oldProfileReference.get();

  if (!oldProfileDocument.exists) {
    logger.error("Old unclaimed profile not found for email change", {
      errorId: ERROR_IDS.ADMIN_CHANGE_EMAIL_PROFILE_NOT_FOUND,
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
      errorId: ERROR_IDS.ADMIN_CHANGE_EMAIL_NEW_EMAIL_EXISTS,
      oldEmail,
      newEmail,
    });
    throw new HttpError(
      `An unclaimed profile with email ${newEmail} already exists.`,
      409,
    );
  }

  const invitedUserUid = oldProfileData["invitedUserUid"] as string | undefined;
  const warningMessages: string[] = [];

  if (invitedUserUid !== undefined) {
    try {
      const memberReference = firestore
        .collection(MEMBERS_COLLECTION)
        .doc(invitedUserUid);
      const memberDocument = await memberReference.get();

      if (memberDocument.exists) {
        await memberReference.delete();
        logger.info("Deleted old member document during email change", {
          uid: invitedUserUid,
          oldEmail,
        });
      }
    } catch (memberCleanupError) {
      logger.error("Failed to delete old member document during email change", {
        errorId: ERROR_IDS.ADMIN_CHANGE_EMAIL_CLEANUP_FAILED,
        error: memberCleanupError,
        uid: invitedUserUid,
        oldEmail,
        severity: "HIGH",
      });
      warningMessages.push(
        "Old member document could not be cleaned up. Manual cleanup may be needed.",
      );
    }

    try {
      await authentication.deleteUser(invitedUserUid);
      logger.info("Deleted old auth user during email change", {
        uid: invitedUserUid,
        oldEmail,
      });
    } catch (authenticationCleanupError) {
      if (
        authenticationCleanupError &&
        typeof authenticationCleanupError === "object" &&
        "code" in authenticationCleanupError &&
        (authenticationCleanupError as { code: string }).code ===
          "auth/user-not-found"
      ) {
        logger.info(
          "Old auth user already deleted, skipping cleanup during email change",
          {
            uid: invitedUserUid,
            oldEmail,
          },
        );
      } else {
        logger.error("Failed to delete old auth user during email change", {
          errorId: ERROR_IDS.ADMIN_CHANGE_EMAIL_CLEANUP_FAILED,
          error: authenticationCleanupError,
          uid: invitedUserUid,
          oldEmail,
          severity: "HIGH",
        });
        warningMessages.push(
          "Old auth user could not be cleaned up. Manual cleanup may be needed.",
        );
      }
    }
  }

  try {
    const fieldsToStrip = new Set([
      "invitationEmailStatus",
      "invitationEmailSentAt",
      "invitationEmailError",
      "invitedUserUid",
    ]);

    const cleanedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(oldProfileData)) {
      if (!fieldsToStrip.has(key)) {
        cleanedData[key] = value;
      }
    }

    await newProfileReference.set({
      ...cleanedData,
      email: newEmail,
    });

    await oldProfileReference.delete();

    logger.info("Moved unclaimed profile to new email", {
      oldEmail,
      newEmail,
    });
  } catch (moveError) {
    logger.error("Failed to move unclaimed profile to new email", {
      errorId: ERROR_IDS.ADMIN_CHANGE_EMAIL_MOVE_FAILED,
      error: moveError,
      oldEmail,
      newEmail,
    });
    throw new HttpError(
      "Failed to move profile to new email address. Please try again.",
      500,
    );
  }

  try {
    const invitationResult = await sendInvitation({
      email: newEmail,
      emailService,
      logger,
    });

    if (invitationResult.warning !== undefined) {
      warningMessages.push(invitationResult.warning);
    }

    return {
      success: true,
      ...(warningMessages.length > 0 && {
        warning: warningMessages.join(" "),
      }),
    };
  } catch (resendError) {
    logger.error("Profile moved to new email but invitation failed to send", {
      errorId: ERROR_IDS.ADMIN_CHANGE_EMAIL_RESEND_FAILED,
      error: resendError,
      oldEmail,
      newEmail,
      severity: "HIGH",
      actionRequired:
        "Profile was moved but invitation was not sent. Try sending invitation manually.",
    });

    throw new HttpError(
      "Profile email was changed but the invitation failed to send. Please try sending the invitation manually from the new profile page.",
      500,
    );
  }
}
