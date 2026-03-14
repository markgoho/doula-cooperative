import { Timestamp } from "firebase-admin/firestore";
import type {
  MemberDocument,
  UnclaimedProfileDocumentData,
} from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { NEWSLETTER_EMAIL, NO_REPLY_EMAIL } from "../../../constants/index.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../../shared-api/services/email/index.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import { escapeHtml } from "../../../shared-api/utils/html-escape.js";
import { addNewsletterSubscriber } from "../../../shared-api/utils/mailerlite.js";
import { calculateExpirationDate } from "../../../stripe-webhook-api/utils/index.js";
import type { AuthUpdateService } from "../auth-update/interface.js";
import type { ClaimProfileFirestoreService } from "../firestore/interface.js";

function createMailerLiteFailureEmailHtml({
  email,
  name,
  uid,
  subscriptionStart,
  membershipExpiresAt,
  errorMessage,
  source,
}: {
  email: string;
  name: string | undefined;
  uid: string;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
  source: string;
}): string {
  return `
    <h2>MailerLite Newsletter Signup Failed During Imported Member Merge</h2>
    <p>An imported member record was merged but could not be added to the newsletter automatically.</p>

    <h3>Merge Details:</h3>
    <ul>
      <li><strong>Source:</strong> ${escapeHtml(source)}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Name:</strong> ${escapeHtml(name) || "Not provided"}</li>
      <li><strong>UID:</strong> ${escapeHtml(uid)}</li>
      <li><strong>Subscription Start:</strong> ${escapeHtml(subscriptionStart.toDate().toISOString())}</li>
      <li><strong>Membership Expires:</strong> ${escapeHtml(membershipExpiresAt.toDate().toISOString())}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${escapeHtml(errorMessage)}</p>

    <p><strong>Action Required:</strong> Manually add this member to the MailerLite newsletter.</p>
    <p><strong>Note:</strong> The member document has been updated with newsletterSubscribed: true, but MailerLite is out of sync.</p>
  `;
}

async function sendMailerLiteFailureNotification({
  email,
  name,
  uid,
  subscriptionStart,
  membershipExpiresAt,
  errorMessage,
  emailService,
  logger,
  source,
}: {
  email: string;
  name: string | undefined;
  uid: string;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
  emailService: EmailServiceInterface;
  logger: Logger;
  source: string;
}): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject: "Action Required: Manual Newsletter Signup (Imported Member Merge)",
      html: createMailerLiteFailureEmailHtml({
        email,
        name,
        uid,
        subscriptionStart,
        membershipExpiresAt,
        errorMessage,
        source,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
  } catch (emailNotificationError: unknown) {
    logger.error("Failed to send imported member merge MailerLite failure notification", {
      errorId: ERROR_IDS.CLAIM_PROFILE_EMAIL_SERVICE_FAILED,
      error: emailNotificationError,
      errorMessage:
        emailNotificationError instanceof Error
          ? emailNotificationError.message
          : "Unknown error",
      errorStack:
        emailNotificationError instanceof Error
          ? emailNotificationError.stack
          : undefined,
      uid,
      email,
      source,
      context: "Attempting to notify admin of MailerLite sync failure during imported member merge",
    });
    throw emailNotificationError;
  }
}

type ImportedMemberMergeFields = Pick<
  MemberDocument,
  | "email"
  | "subscriptionStart"
  | "membershipActive"
  | "membershipExpiresAt"
  | "newsletterSubscribed"
  | "newsletterSubscribedAt"
  | "profileCreatedAt"
> & {
  name: string;
  slug?: string;
};

export type ApplyImportedMemberMergeResult =
  | {
      status: "merged";
      mergedFields: ImportedMemberMergeFields;
      importEmail: string;
      warning?: string;
      newsletterHandledByMerge: true;
    }
  | {
      status: "not_found";
      importEmail: string;
      warning?: string;
    }
  | {
      status: "invalid_import_data";
      importEmail: string;
      warning?: string;
    };

/**
 * Applies imported legacy member data to an existing member account and reports
 * whether the merge succeeded, was not needed, or could not proceed because the
 * imported record is incomplete.
 */
export async function applyImportedMemberMerge({
  uid,
  email,
  emailService,
  firestoreService,
  authUpdateService,
  logger,
  source,
}: {
  uid: string;
  email: string;
  emailService: EmailServiceInterface;
  firestoreService: ClaimProfileFirestoreService;
  authUpdateService: AuthUpdateService;
  logger: Logger;
  source: "claim_profile" | "stripe_webhook" | "admin_manual_attach";
}): Promise<ApplyImportedMemberMergeResult> {
  const importDocument = await firestoreService.getImportDocument(email);

  if (!importDocument.exists) {
    logger.info("No imported member record found for merge", {
      uid,
      email,
      source,
    });
    return {
      status: "not_found",
      importEmail: email,
    };
  }

  const profileData = importDocument.data() as UnclaimedProfileDocumentData | undefined;

  if (!profileData) {
    logger.error("Imported member document exists but has no data", {
      errorId: ERROR_IDS.CLAIM_PROFILE_NO_DATA,
      email,
      uid,
      source,
      documentExists: true,
      documentId: importDocument.id,
    });
    return {
      status: "invalid_import_data",
      importEmail: email,
      warning: "Imported member record has no data.",
    };
  }

  if (!profileData.subscriptionStart) {
    logger.error("Imported member missing required subscriptionStart field", {
      errorId: ERROR_IDS.CLAIM_PROFILE_INVALID_DATA,
      email,
      uid,
      source,
      profileData: {
        hasName: Boolean(profileData.name),
        hasEmail: Boolean(profileData.email),
        hasCreatedAt: Boolean(profileData.createdAt),
      },
    });
    return {
      status: "invalid_import_data",
      importEmail: email,
      warning: "Imported member record is missing subscription information.",
    };
  }

  if (!profileData.name || profileData.name.trim().length === 0) {
    logger.error("Imported member missing required name field", {
      errorId: ERROR_IDS.CLAIM_PROFILE_INVALID_DATA,
      email,
      uid,
      source,
      hasName: Boolean(profileData.name),
      nameLength: profileData.name?.length ?? 0,
    });
    return {
      status: "invalid_import_data",
      importEmail: email,
      warning: "Imported member record is missing a name.",
    };
  }

  const { name, slug, subscriptionStart, createdAt } = profileData;
  const membershipExpiresAt = calculateExpirationDate(subscriptionStart);

  const memberUpdate: ImportedMemberMergeFields = {
    email,
    name,
    ...(slug !== undefined && { slug }),
    subscriptionStart,
    membershipActive: true,
    membershipExpiresAt,
    newsletterSubscribed: true,
    newsletterSubscribedAt: Timestamp.now(),
    ...(createdAt !== undefined && { profileCreatedAt: createdAt }),
  };

  await firestoreService.writeMemberDocument(uid, memberUpdate);
  logger.info("Successfully merged imported member data", {
    uid,
    email,
    source,
    hasSlug: Boolean(memberUpdate.slug),
    fieldCount: Object.keys(memberUpdate).length,
  });

  const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];
  let warning: string | undefined;
  if (mailerliteApiKey) {
    try {
      const subscriberOptions: {
        email: string;
        name: string;
        subscriptionStart: Timestamp;
        membershipExpiresAt: Timestamp;
        groupId?: string;
        apiKey: string;
      } = {
        email,
        name: profileData.name,
        subscriptionStart,
        membershipExpiresAt,
        apiKey: mailerliteApiKey,
      };

      const groupId = process.env["MAILERLITE_GROUP_ID"];
      if (groupId !== undefined) {
        subscriberOptions.groupId = groupId;
      }

      await addNewsletterSubscriber(subscriberOptions);
      logger.info("Added subscriber to MailerLite during imported member merge", {
        uid,
        email,
        source,
      });
    } catch (newsletterError) {
      const errorMessage =
        newsletterError instanceof Error ? newsletterError.message : "Unknown error";

      logger.error("Failed to add subscriber to MailerLite during imported member merge", {
        errorId: ERROR_IDS.CLAIM_PROFILE_MAILERLITE_FAILED,
        email,
        uid,
        source,
        error: newsletterError,
        context: "Member is subscribed in Firestore but not in MailerLite",
      });

      try {
        await sendMailerLiteFailureNotification({
          email,
          name: profileData.name,
          uid,
          subscriptionStart,
          membershipExpiresAt,
          errorMessage,
          emailService,
          logger,
          source,
        });
        logger.info("Sent MailerLite failure notification for imported member merge", {
          uid,
          email,
          source,
        });
      } catch (notificationError: unknown) {
        logger.error(
          "CRITICAL: Failed to send MailerLite failure notification during imported member merge",
          {
            errorId: ERROR_IDS.CLAIM_PROFILE_NOTIFICATION_FAILED,
            uid,
            email,
            source,
            severity: "CRITICAL",
            context:
              "MailerLite sync failed during imported member merge AND notification email failed - admin is unaware",
            actionRequired:
              "Check Sentry alerts immediately and manually add member to MailerLite",
            originalMailerLiteError: errorMessage,
            notificationError,
          },
        );
      }
    }
  } else if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.warn("MAILERLITE_API_KEY not configured - emulator mode, skipping newsletter sync", {
      uid,
      email,
      source,
    });
  } else {
    logger.error("CRITICAL: MAILERLITE_API_KEY not configured during imported member merge", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_MAILERLITE_NOT_CONFIGURED,
      uid,
      email,
      source,
      severity: "CRITICAL",
      actionRequired:
        "Configure MAILERLITE_API_KEY in Firebase Functions secrets immediately",
      impact: "Imported member merges will not sync newsletter subscriptions",
    });
    warning = "Newsletter not configured - manual signup required";
  }

  if (warning === undefined) {
    try {
      await authUpdateService.updateDisplayName(uid, profileData.name);
      logger.info("Successfully updated displayName during imported member merge", {
        uid,
        email,
        source,
      });
    } catch (authError) {
      logger.error("Error updating auth displayName during imported member merge", {
        errorId: ERROR_IDS.CLAIM_PROFILE_AUTH_UPDATE_FAILED,
        email,
        uid,
        source,
        error: authError,
      });
      warning = "Profile merged but display name update failed";
    }
  } else {
    try {
      await authUpdateService.updateDisplayName(uid, profileData.name);
      logger.info("Successfully updated displayName during imported member merge", {
        uid,
        email,
        source,
      });
    } catch (authError) {
      logger.error("Error updating auth displayName during imported member merge", {
        errorId: ERROR_IDS.CLAIM_PROFILE_AUTH_UPDATE_FAILED,
        email,
        uid,
        source,
        error: authError,
      });
    }
  }

  try {
    await firestoreService.deleteImportDocument(email);
    logger.info("Successfully deleted import record after imported member merge", {
      uid,
      email,
      source,
    });
  } catch (deleteError) {
    logger.error("Failed to delete import record after imported member merge", {
      errorId: ERROR_IDS.CLAIM_PROFILE_IMPORT_DELETE_FAILED,
      email,
      uid,
      source,
      error: deleteError,
    });
    warning = warning ?? "Profile merged but import record cleanup failed";
  }

  return {
    status: "merged",
    mergedFields: memberUpdate,
    importEmail: email,
    ...(warning !== undefined && { warning }),
    newsletterHandledByMerge: true,
  };
}
