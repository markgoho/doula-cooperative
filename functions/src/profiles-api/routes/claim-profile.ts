import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  MEMBERS_COLLECTION,
  type MemberDocument,
  type UnclaimedProfileDocumentData,
} from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { NEWSLETTER_EMAIL, NO_REPLY_EMAIL } from "../../constants/index.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type {
  EmailServiceInterface,
  EmailMessage,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import { escapeHtml } from "../../utils/html-escape.js";
import { addNewsletterSubscriber } from "../../utils/mailerlite.js";

/**
 * Response returned when successfully claiming a profile.
 * Uses discriminated union to ensure status and data are properly correlated.
 */
export type ClaimProfileResponse =
  | {
      status: "success";
      data: UnclaimedProfileDocumentData;
    }
  | {
      status: "no_profile_to_claim";
    };

/**
 * Creates HTML for MailerLite failure notification email during profile claim
 */
function createClaimProfileMailerLiteFailureEmailHtml({
  email,
  name,
  uid,
  subscriptionStart,
  membershipExpiresAt,
  errorMessage,
}: {
  email: string;
  name: string | undefined;
  uid: string;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
}): string {
  return `
    <h2>MailerLite Newsletter Signup Failed During Profile Claim</h2>
    <p>A member claimed their profile but could not be added to the newsletter automatically.</p>

    <h3>Member Details:</h3>
    <ul>
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

/**
 * Sends notification email when MailerLite subscription fails during profile claim
 */
async function sendClaimProfileMailerLiteFailureNotification({
  email,
  name,
  uid,
  subscriptionStart,
  membershipExpiresAt,
  errorMessage,
  emailService,
  logger,
}: {
  email: string;
  name: string | undefined;
  uid: string;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject: "Action Required: Manual Newsletter Signup (Profile Claim)",
      html: createClaimProfileMailerLiteFailureEmailHtml({
        email,
        name,
        uid,
        subscriptionStart,
        membershipExpiresAt,
        errorMessage,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
  } catch {
    // Already logged by sendEmail, error logged below in caller
  }
}

/**
 * Calculate the expiration date for a membership based on the subscription start date.
 * Membership expires on the last day of the subscription month in the current or next year.
 */
function calculateExpirationDate(subscriptionStart: Timestamp): Timestamp {
  const startDate = subscriptionStart.toDate();
  const monthIndex = startDate.getMonth(); // 0-11

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let expirationYear = currentYear;

  // If the renewal month has already passed this year, or we are in the renewal month,
  // the next renewal is next year.
  if (
    currentMonth > monthIndex ||
    (currentMonth === monthIndex && now.getDate() > 1)
  ) {
    expirationYear += 1;
  }

  // Set the expiration to the last day of the subscription month in the expiration year.
  const expirationDate = new Date(expirationYear, monthIndex + 1, 0);
  return Timestamp.fromDate(expirationDate);
}

/**
 * Claim an unclaimed profile for the authenticated user.
 * This function:
 * 1. Looks for a matching document in the import collection
 * 2. Creates/updates the member document with the profile data
 * 3. Calculates membership expiration date
 * 4. Subscribes user to newsletter (non-critical)
 * 5. Updates auth displayName if profile has name
 * 6. Deletes the import document
 */
export async function claimProfileLogic({
  uid,
  email,
  emailVerified,
  emailService,
  logger,
  set,
}: {
  uid: string;
  email: string;
  emailVerified: boolean;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ClaimProfileResponse | { error: string }> {
  // Ensure the user's email is verified
  if (!emailVerified) {
    set.status = 428;
    return {
      error: "The user must have a verified email to claim a profile.",
    };
  }

  const database = getFirestore();

  try {
    // Look for a matching document in the import collection
    const importDocumentReference = database
      .collection(IMPORT_COLLECTION)
      .doc(email);
    const importDocument = await importDocumentReference.get();

    if (!importDocument.exists) {
      // No pre-existing profile to claim
      logger.info(`No profile to claim for user: ${email}`);
      return { status: "no_profile_to_claim" };
    }

    const profileData = importDocument.data() as
      | UnclaimedProfileDocumentData
      | undefined;

    if (!profileData) {
      logger.error("Profile document exists but has no data", {
        errorId: ERROR_IDS.CLAIM_PROFILE_NO_DATA,
        email,
        uid,
        documentExists: true,
        documentId: importDocument.id,
      });
      throw new NotFoundError("No profile data found for this user.");
    }

    // Validate required fields (runtime validation despite TypeScript types)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime validation needed for Firestore data
    if (!profileData.subscriptionStart) {
      logger.error("Profile missing required subscriptionStart field", {
        errorId: ERROR_IDS.CLAIM_PROFILE_INVALID_DATA,
        email,
        uid,
        profileData: {
          hasName: Boolean(profileData.name),
          hasEmail: Boolean(profileData.email),
          hasCreatedAt: Boolean(profileData.createdAt),
        },
      });
      set.status = 500;
      return { error: "Profile data is incomplete. Please contact support." };
    }

    if (!profileData.name || profileData.name.trim().length === 0) {
      logger.error("Profile missing required name field", {
        errorId: ERROR_IDS.CLAIM_PROFILE_INVALID_DATA,
        email,
        uid,
        hasName: Boolean(profileData.name),
        nameLength: profileData.name.length,
      });
      set.status = 500;
      return { error: "Profile data is incomplete. Please contact support." };
    }

    const { subscriptionStart, createdAt, ...restOfProfileData } = profileData;

    // Calculate membership expiration date
    let membershipExpiresAt: Timestamp;
    try {
      membershipExpiresAt = calculateExpirationDate(subscriptionStart);
    } catch (error) {
      logger.error("Error calculating expiration date", {
        errorId: ERROR_IDS.CLAIM_PROFILE_EXPIRATION_CALC_ERROR,
        email,
        uid,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        subscriptionStartValue: subscriptionStart,
        subscriptionStartSeconds: subscriptionStart.seconds,
        subscriptionStartDate: subscriptionStart.toDate().toISOString(),
      });
      set.status = 500;
      return { error: "Failed to calculate membership expiration date." };
    }

    // Create the member document update
    const memberUpdate: Partial<MemberDocument> = {
      ...restOfProfileData,
      subscriptionStart,
      membershipActive: true,
      membershipExpiresAt,
      // If legacy profile has createdAt, use it as profileCreatedAt
      ...(createdAt !== undefined && { profileCreatedAt: createdAt }),
      // Subscribe to newsletter when claiming profile
      newsletterSubscribed: true,
      newsletterSubscribedAt: Timestamp.now(),
    };

    // Write member document
    try {
      const memberDocumentReference = database
        .collection(MEMBERS_COLLECTION)
        .doc(uid);
      await memberDocumentReference.set(memberUpdate, { merge: true });
      logger.info(
        `Successfully claimed profile for user: ${email} (UID: ${uid})`,
      );
    } catch (error) {
      logger.error("Error writing member document", {
        errorId: ERROR_IDS.CLAIM_PROFILE_FIRESTORE_WRITE_ERROR,
        email,
        uid,
        error,
      });
      set.status = 500;
      return { error: "Failed to save profile data. Please try again." };
    }

    // Add to newsletter (non-critical - don't fail if this fails)
    const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];
    if (mailerliteApiKey) {
      try {
        await addNewsletterSubscriber({
          email,
          name: profileData.name,
          subscriptionStart,
          membershipExpiresAt,
          ...(process.env["MAILERLITE_GROUP_ID"] !== undefined && {
            groupId: process.env["MAILERLITE_GROUP_ID"],
          }),
          apiKey: mailerliteApiKey,
        });
        logger.info(`Added subscriber to MailerLite newsletter: ${email}`);
      } catch (newsletterError) {
        const errorMessage =
          newsletterError instanceof Error
            ? newsletterError.message
            : "Unknown error";

        logger.error(
          "Failed to add subscriber to MailerLite during profile claim",
          {
            errorId: ERROR_IDS.CLAIM_PROFILE_MAILERLITE_FAILED,
            email,
            uid,
            error: newsletterError,
            context: "Member is subscribed in Firestore but not in MailerLite",
          },
        );

        // Send notification email
        try {
          await sendClaimProfileMailerLiteFailureNotification({
            email,
            name: profileData.name,
            uid,
            subscriptionStart,
            membershipExpiresAt,
            errorMessage,
            emailService,
            logger,
          });
          logger.info(
            "Sent MailerLite failure notification email for profile claim",
            {
              uid,
              email,
            },
          );
        } catch {
          logger.error(
            "CRITICAL: Failed to send MailerLite failure notification email during profile claim",
            {
              errorId: ERROR_IDS.CLAIM_PROFILE_NOTIFICATION_FAILED,
              uid,
              email,
              severity: "CRITICAL",
              context:
                "MailerLite sync failed during profile claim AND notification email failed - admin is unaware",
              actionRequired:
                "Check Sentry alerts immediately and manually add member to MailerLite",
              originalMailerLiteError: errorMessage,
            },
          );
        }
      }
    }

    // Update the auth displayName with profile name
    const auth = getAuth();
    try {
      await auth.updateUser(uid, {
        displayName: profileData.name,
      });
      logger.info(`Successfully updated displayName for user: ${email}`);
    } catch (authError) {
      // Log error but don't fail the whole operation - profile claim was successful
      logger.error("Error updating auth displayName", {
        errorId: ERROR_IDS.CLAIM_PROFILE_AUTH_UPDATE_FAILED,
        email,
        uid,
        error: authError,
      });
    }

    // Delete the document from the import collection
    try {
      await importDocumentReference.delete();
      logger.info(`Successfully deleted import record for: ${email}`);
    } catch (deleteError) {
      // Log error but don't fail - profile claim was successful
      // Import cleanup is not critical but should be tracked for data hygiene
      logger.error("Failed to delete import record after successful claim", {
        errorId: ERROR_IDS.CLAIM_PROFILE_IMPORT_DELETE_FAILED,
        email,
        uid,
        error: deleteError,
      });
    }

    return { status: "success", data: profileData };
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "claim profile",
      errorId: ERROR_IDS.CLAIM_PROFILE_FAILED,
      logger,
      set,
      context: { uid, email },
    });
  }
}
