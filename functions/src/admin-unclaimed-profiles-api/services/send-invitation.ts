import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  type UnclaimedProfileDocumentData,
} from "../../collections/index.js";
import { ERROR_IDS, NO_REPLY_EMAIL } from "../../constants/index.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { SendInvitationSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";

interface SendInvitationOptions {
  email: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}

/**
 * Send an invitation email to a member to claim their subscription.
 * Includes subscription details (start date, renewal date, days remaining).
 */
export async function sendInvitation({
  email,
  emailService,
  logger,
}: SendInvitationOptions): Promise<SendInvitationSuccessResponse> {
  // Validate email is provided
  if (!email || typeof email !== "string") {
    logger.error("Invalid email provided to send invitation", {
      errorId: ERROR_IDS.ADMIN_SEND_INVITATION_INVALID_EMAIL,
      email,
    });
    throw new HttpError("Email is required and must be a string.", 400);
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
      });
      throw new HttpError(
        `Unclaimed profile with email ${email} not found.`,
        404,
      );
    }

    const unclaimedProfileData = unclaimedProfileDocument.data();

    // Validate member has required fields before type assertion
    if (!unclaimedProfileData?.["subscriptionStart"]) {
      logger.error("Unclaimed profile missing required data for invitation", {
        errorId: ERROR_IDS.ADMIN_SEND_INVITATION_NO_SUBSCRIPTION,
        email,
        hasData: Boolean(unclaimedProfileData),
        hasSubscriptionStart: Boolean(
          unclaimedProfileData?.["subscriptionStart"],
        ),
      });
      throw new HttpError(
        "Unclaimed profile is missing required data (subscriptionStart).",
        412,
      );
    }

    // For unclaimed profiles, the email is the document ID, not in the data
    const member = {
      ...unclaimedProfileData,
      email,
    } as UnclaimedProfileDocumentData & { email: string };

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

    const emailMessage: EmailMessage = {
      from: `Rochester Doula Cooperative <${NO_REPLY_EMAIL}>`,
      to: member.email,
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

    // Send email via injected EmailService
    // In emulator mode (FUNCTIONS_EMULATOR=true), email sending is automatically skipped
    try {
      await emailService.sendEmail({ message: emailMessage }, logger);
      logger.info("Invitation email sent successfully", {
        email,
        recipientEmail: member.email,
      });
    } catch (error) {
      logger.error("Failed to send invitation email", {
        error,
        errorId: ERROR_IDS.ADMIN_SEND_INVITATION_EMAIL_FAILED,
        email,
        recipientEmail: member.email,
      });

      // Track email failure in Firestore (handle cascading failure)
      try {
        await unclaimedProfileReference.update({
          invitationEmailStatus: "failed",
          invitationEmailError:
            error instanceof Error ? error.message : "Unknown error",
        });
      } catch (firestoreError) {
        // CRITICAL: Both email sending AND Firestore tracking failed
        logger.error(
          "CRITICAL: Failed to update invitation status in Firestore after email failure",
          {
            errorId: ERROR_IDS.ADMIN_SEND_INVITATION_FIRESTORE_UPDATE_FAILED,
            error: firestoreError,
            errorMessage:
              firestoreError instanceof Error
                ? firestoreError.message
                : "Unknown error",
            errorStack:
              firestoreError instanceof Error ? firestoreError.stack : undefined,
            originalEmailError: error,
            email,
          },
        );
        // Still throw the original email error to user (Firestore failure is logged)
      }

      throw new HttpError("Failed to send invitation email.", 500);
    }

    // Update member document with invitation tracking
    try {
      await unclaimedProfileReference.update({
        invitationEmailStatus: "sent",
        invitationEmailSentAt: now,
        invitationEmailError: FieldValue.delete(),
      });

      logger.info("Invitation sent and tracked successfully", {
        email,
      });

      return { success: true };
    } catch (firestoreError) {
      // Email sent successfully but tracking failed - warn user
      logger.error(
        "WARNING: Invitation email sent but failed to update tracking in Firestore",
        {
          errorId: ERROR_IDS.ADMIN_SEND_INVITATION_TRACKING_FAILED,
          error: firestoreError,
          errorMessage:
            firestoreError instanceof Error
              ? firestoreError.message
              : "Unknown error",
          errorStack:
            firestoreError instanceof Error ? firestoreError.stack : undefined,
          email,
          recipientEmail: member.email,
        },
      );

      // Return partial success with warning
      return {
        success: true,
        warning:
          "Invitation sent but tracking update failed. The email was delivered successfully.",
      };
    }
  } catch (error) {
    // Re-throw HttpError instances (already logged)
    if (error instanceof HttpError) {
      throw error;
    }

    // Log and wrap unexpected errors
    logger.error("Unexpected error sending invitation", {
      error,
      email,
    });
    throw new HttpError(
      "An unexpected error occurred while sending invitation.",
      500,
    );
  }
}
