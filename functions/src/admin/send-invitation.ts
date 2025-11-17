import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { MailgunMessageData } from "mailgun.js/definitions";
import type { UnclaimedProfileData } from "../claim-profile/index.js";
import {
  ERROR_IDS,
  IMPORT_COLLECTION,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants/index.js";
import { sendEmail } from "../utils/send-email.js";
import { verifyAdmin } from "./verify-admin.js";

export interface SendInvitationRequest {
  email: string;
}

export interface SendInvitationResponse {
  success: boolean;
}

/**
 * Admin function to send an invitation email to a member to claim their subscription.
 * Includes subscription details (start date, renewal date, days remaining).
 */
export async function handleSendInvitation(
  data: SendInvitationRequest,
  context: CallableRequest,
  mailgunApiKey: string | undefined,
): Promise<SendInvitationResponse> {
  // Verify admin privileges
  verifyAdmin(context);

  const { email } = data;

  // Validate email is provided
  if (!email || typeof email !== "string") {
    logger.error("Invalid email provided to send invitation", {
      errorId: ERROR_IDS.ADMIN_SEND_INVITATION_INVALID_UID,
      email,
      adminUid: context.auth?.uid,
    });
    throw new HttpsError(
      "invalid-argument",
      "Email is required and must be a string.",
    );
  }

  try {
    const firestore = getFirestore();

    // Look up unclaimed profile in migrated_users_import collection
    // The email IS the document ID in this collection
    const unclaimedProfileReference = firestore
      .collection(IMPORT_COLLECTION)
      .doc(email);
    const unclaimedProfileDocument = await unclaimedProfileReference.get();

    if (!unclaimedProfileDocument.exists) {
      logger.error("Unclaimed profile not found for invitation", {
        errorId: ERROR_IDS.ADMIN_SEND_INVITATION_MEMBER_NOT_FOUND,
        email,
        adminUid: context.auth?.uid,
      });
      throw new HttpsError(
        "not-found",
        `Unclaimed profile with email ${email} not found.`,
      );
    }

    const unclaimedProfileData = unclaimedProfileDocument.data();

    // Validate member has required fields before type assertion
    if (!unclaimedProfileData?.["subscriptionStart"]) {
      logger.error("Unclaimed profile missing required data for invitation", {
        errorId: ERROR_IDS.ADMIN_SEND_INVITATION_NO_SUBSCRIPTION,
        email,
        adminUid: context.auth?.uid,
        hasData: !!unclaimedProfileData,
        hasSubscriptionStart: !!unclaimedProfileData?.["subscriptionStart"],
      });
      throw new HttpsError(
        "failed-precondition",
        "Unclaimed profile is missing required data (subscriptionStart).",
      );
    }

    // For unclaimed profiles, the email is the document ID, not in the data
    const member = {
      ...unclaimedProfileData,
      email,
    } as UnclaimedProfileData & { email: string };

    // Build invitation email
    const now = Timestamp.now();

    const subscriptionStartDate = member.subscriptionStart
      .toDate()
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

    const memberName = member.name || "Member";

    // Build membership details HTML (renewal info is optional)
    const membershipDetailsHtml = `<li><strong>Subscription Started:</strong> ${subscriptionStartDate}</li>`;

    const emailMessage: MailgunMessageData = {
      from: `Rochester Doula Cooperative <${NO_REPLY_EMAIL}>`,
      to: member.email,
      bcc: REFERRAL_EMAIL,
      subject: "Claim Your Rochester Doula Cooperative Membership",
      html: `
        <h2>Hello ${memberName},</h2>

        <p>You're receiving this invitation because you have a membership with the Rochester Doula Cooperative.</p>

        <h3>Your Membership Details:</h3>
        <ul>
          ${membershipDetailsHtml}
        </ul>

        <h3>Get Started:</h3>
        <p>To access your member dashboard and manage your profile, click the button below to create your account:</p>

        <p><a href="https://members.doulacooperative.com/sign-up?email=${encodeURIComponent(member.email)}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Create Your Account</a></p>

        <p>Once you create your account, you'll have full access to:</p>
        <ul>
          <li>Your member dashboard</li>
          <li>Profile management</li>
          <li>Membership information</li>
          <li>And more!</li>
        </ul>

        <p>If you have any questions, please don't hesitate to reach out.</p>

        <p>Best regards,<br>
        Rochester Doula Cooperative</p>
      `,
    };

    // Send email (skip only in test mode when no API key is provided)
    // Email sending is prevented when:
    // - mailgunApiKey is undefined (unit tests pass undefined)
    //
    // During local development with emulators:
    // - If MAILGUN_API_KEY secret is configured, emails WILL be sent (for testing)
    // - This allows you to test the actual email content and delivery
    //
    // TODO: For additional safety, you can add email domain restrictions:
    // - Only send to specific domains during development (e.g., @doulacooperative.com)
    // - Use a feature flag or environment variable (e.g., ENABLE_INVITATION_EMAILS)
    if (mailgunApiKey === undefined) {
      logger.info("Test mode detected (no API key), skipping email dispatch.", {
        recipientEmail: member.email,
        email,
        adminUid: context.auth?.uid,
      });
      logger.info(`Would have sent invitation email to: ${member.email}`);
    } else {
      // Send the email (works in both local dev and production)
      // Uncomment the following lines if you want to add email domain restrictions:
      // const allowedDomains = ['doulacooperative.com'];
      // const emailDomain = member.email.split('@')[1];
      // if (!allowedDomains.includes(emailDomain)) {
      //   logger.warn("Skipping email to non-approved domain", { recipientEmail: member.email });
      //   return { success: true };
      // }
      try {
        await sendEmail(emailMessage, mailgunApiKey);
        logger.info("Invitation email sent successfully", {
          email,
          recipientEmail: member.email,
          adminUid: context.auth?.uid,
        });
      } catch (error) {
        logger.error("Failed to send invitation email", {
          error,
          errorId: ERROR_IDS.ADMIN_SEND_INVITATION_EMAIL_FAILED,
          email,
          recipientEmail: member.email,
          adminUid: context.auth?.uid,
        });
        // Update member document with error
        await unclaimedProfileReference.update({
          invitationEmailStatus: "failed",
          invitationEmailError:
            error instanceof Error ? error.message : "Unknown error",
        });
        throw new HttpsError("internal", "Failed to send invitation email.");
      }
    }

    // Update member document with invitation tracking
    await unclaimedProfileReference.update({
      invitationEmailStatus: "sent",
      invitationEmailSentAt: now,
      invitationEmailError: FieldValue.delete(),
    });

    logger.info("Invitation sent and tracked successfully", {
      email,
      adminUid: context.auth?.uid,
    });

    return { success: true };
  } catch (error) {
    // Re-throw HttpsError instances (already logged)
    if (error instanceof HttpsError) {
      throw error;
    }

    // Log and wrap unexpected errors
    logger.error("Unexpected error sending invitation", {
      error,
      email,
      adminUid: context.auth?.uid,
    });
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while sending invitation.",
    );
  }
}
