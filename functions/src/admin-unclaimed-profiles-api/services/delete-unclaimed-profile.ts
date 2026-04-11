import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION } from "../../collections/migrated-users-import.js";
import {
  ERROR_IDS,
  NEWSLETTER_EMAIL,
  NO_REPLY_EMAIL,
} from "../../constants/index.js";
import { draftProfile } from "../../profiles-api/services/profile-store/draft-profile.js";
import { triggerHugoRebuild } from "../../profiles-api/services/profile-store/trigger-rebuild.js";
import {
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";
import { removeNewsletterSubscriber } from "../../shared-api/utils/mailerlite.js";

/**
 * Creates HTML for newsletter unsubscribe failure notification email
 */
function createUnsubscribeFailureEmailHtml({
  email,
  errorMessage,
}: {
  email: string;
  errorMessage: string;
}): string {
  return `
    <h2>MailerLite Newsletter Unsubscribe Failed</h2>
    <p>An admin deleted an unclaimed profile, but the MailerLite unsubscribe failed.</p>

    <h3>Profile Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${escapeHtml(errorMessage)}</p>

    <p><strong>Action Required:</strong> Manually unsubscribe this email from the MailerLite newsletter.</p>
  `;
}

/**
 * Sends notification email when newsletter unsubscribe fails during profile deletion
 */
async function sendUnsubscribeFailureNotification({
  email,
  errorMessage,
  emailService,
  logger,
}: {
  email: string;
  errorMessage: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject:
        "Newsletter Unsubscribe Failed During Profile Deletion - Action Required",
      html: createUnsubscribeFailureEmailHtml({
        email,
        errorMessage,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent newsletter unsubscribe failure notification email", {
      email,
    });
  } catch (emailError) {
    logger.error(
      "CRITICAL: Failed to send newsletter unsubscribe failure notification email",
      {
        errorId:
          ERROR_IDS.API_ADMIN_DELETE_UNCLAIMED_PROFILE_NOTIFICATION_FAILED,
        email,
        error: emailError,
        severity: "CRITICAL",
        context: "MailerLite unsubscribe failed AND notification email failed",
        originalError: errorMessage,
      },
    );
  }
}

/**
 * Creates HTML for profile draft failure notification email
 */
function createDraftFailureEmailHtml({
  email,
  slug,
  errorMessage,
}: {
  email: string;
  slug: string;
  errorMessage: string;
}): string {
  return `
    <h2>Profile Draft Failed</h2>
    <p>An admin deleted an unclaimed profile, but setting the Firestore profile to draft failed.</p>

    <h3>Profile Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Slug:</strong> ${escapeHtml(slug)}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${escapeHtml(errorMessage)}</p>

    <p><strong>Action Required:</strong> Manually set <code>draft: true</code> on the Firestore document at <code>profiles/${escapeHtml(slug)}</code>.</p>
  `;
}

/**
 * Sends notification email when profile drafting fails during profile deletion
 */
async function sendDraftFailureNotification({
  email,
  slug,
  errorMessage,
  emailService,
  logger,
}: {
  email: string;
  slug: string;
  errorMessage: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject: "Profile Draft Failed During Profile Deletion - Action Required",
      html: createDraftFailureEmailHtml({
        email,
        slug,
        errorMessage,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent profile draft failure notification email", {
      email,
      slug,
    });
  } catch (emailError) {
    logger.error(
      "CRITICAL: Failed to send profile draft failure notification email",
      {
        errorId:
          ERROR_IDS.API_ADMIN_DELETE_UNCLAIMED_PROFILE_NOTIFICATION_FAILED,
        email,
        slug,
        error: emailError,
        severity: "CRITICAL",
        context: "Profile draft failed AND notification email failed",
        originalError: errorMessage,
      },
    );
  }
}

/**
 * Delete an unclaimed profile from the migrated_users_import collection.
 * This is used to remove profiles for users who have cancelled their subscription
 * before claiming their account.
 *
 * Also unsubscribes the email from the MailerLite newsletter (best-effort).
 * If the profile has a slug, sets the profile to draft in Firestore (best-effort).
 */
export async function deleteUnclaimedProfile(options: {
  email: string;
  mailerliteApiKey: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<{ success: true; profileDrafted?: boolean }> {
  const { email, mailerliteApiKey, emailService, logger } = options;

  try {
    const firestore = getFirestore();
    const documentReference = firestore
      .collection(IMPORT_COLLECTION)
      .doc(email);
    const document = await documentReference.get();

    if (!document.exists) {
      logger.warn("Unclaimed profile not found", {
        errorId: ERROR_IDS.API_UNCLAIMED_PROFILE_NOT_FOUND,
        email,
      });
      throw new NotFoundError(
        `Unclaimed profile with email ${email} not found`,
      );
    }

    // Best-effort: Unsubscribe from MailerLite newsletter before deletion
    // This ensures the person no longer receives newsletters after their profile is deleted
    try {
      await removeNewsletterSubscriber({
        email,
        apiKey: mailerliteApiKey,
      });
      logger.info("Unsubscribed email from MailerLite newsletter", { email });
    } catch (mailerliteError) {
      // Log the error but continue with deletion (best-effort)
      const errorMessage =
        mailerliteError instanceof Error
          ? mailerliteError.message
          : "Unknown error";

      logger.error(
        "Failed to unsubscribe from MailerLite during profile deletion",
        {
          errorId:
            ERROR_IDS.API_ADMIN_DELETE_UNCLAIMED_PROFILE_MAILERLITE_FAILED,
          email,
          error: mailerliteError,
          errorMessage,
          actionRequired: "Manual unsubscribe may be needed in MailerLite",
        },
      );

      // Send notification email about the failure
      await sendUnsubscribeFailureNotification({
        email,
        errorMessage,
        emailService,
        logger,
      });
    }

    // Best-effort: Set profile to draft in Firestore if the profile has a slug
    const documentData = document.data();
    const slug =
      documentData !== undefined && typeof documentData["slug"] === "string"
        ? documentData["slug"]
        : undefined;
    let profileDrafted: boolean | undefined;

    if (slug !== undefined && slug.length > 0) {
      try {
        await draftProfile({ slug });
        logger.info("Set profile to draft", { email, slug });
        profileDrafted = true;

        // NON-CRITICAL: Trigger Hugo rebuild after drafting
        try {
          await triggerHugoRebuild({
            slug,
            action: "unclaimed profile deleted",
          });
        } catch (rebuildError: unknown) {
          const rebuildErrorMessage =
            rebuildError instanceof Error
              ? rebuildError.message
              : "Unknown error";
          logger.error(
            "Failed to trigger Hugo rebuild after unclaimed profile draft",
            {
              email,
              slug,
              error: rebuildError,
              errorMessage: rebuildErrorMessage,
            },
          );
        }
      } catch (draftError) {
        profileDrafted = false;
        const draftErrorMessage =
          draftError instanceof Error ? draftError.message : "Unknown error";

        logger.error("Failed to set profile to draft during profile deletion", {
          errorId: ERROR_IDS.API_ADMIN_DELETE_UNCLAIMED_PROFILE_DRAFT_FAILED,
          email,
          slug,
          error: draftError,
          errorMessage: draftErrorMessage,
          actionRequired:
            "Manually set draft: true on the Firestore profiles document",
        });

        await sendDraftFailureNotification({
          email,
          slug,
          errorMessage: draftErrorMessage,
          emailService,
          logger,
        });
      }
    }

    // Delete the document
    await documentReference.delete();

    logger.info("Unclaimed profile deleted successfully", {
      email,
      ...(profileDrafted !== undefined && { profileDrafted }),
    });

    return {
      success: true,
      ...(profileDrafted !== undefined && { profileDrafted }),
    };
  } catch (error) {
    // Re-throw known HTTP errors (NotFoundError, etc.)
    if (error instanceof HttpError) {
      throw error;
    }

    // Log and re-throw unexpected Firestore errors
    logger.error("Failed to delete unclaimed profile from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      email,
    });
    throw error;
  }
}
