import type { UserRecord } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  MEMBERS_COLLECTION,
  type MemberDocument,
  type UnclaimedProfileDocumentData,
} from "../../collections/index.js";
import { ADMIN_EMAIL } from "../../constants/admin.js";
import { ERROR_IDS, NO_REPLY_EMAIL } from "../../constants/index.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { generateSecurePassword } from "../../shared-api/utils/generate-secure-password.js";
import type { SendInvitationSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";

interface SendInvitationOptions {
  email: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}

/**
 * Generate the invitation email HTML content.
 */
function generateInvitationEmailHtml(options: {
  memberName: string;
  subscriptionStartDate: string;
  passwordResetLink: string;
}): string {
  const { memberName, subscriptionStartDate, passwordResetLink } = options;

  return `
    <h2>Hello ${memberName},</h2>

    <p>You're receiving this invitation because you have a membership with the Rochester Doula Cooperative.</p>

    <h3>Your Membership Details:</h3>
    <ul>
      <li><strong>Subscription Started:</strong> ${subscriptionStartDate}</li>
    </ul>

    <h3>Get Started:</h3>
    <p>We've created an account for you. Click the button below to set your password and access your member dashboard:</p>

    <p><a href="${passwordResetLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Set Your Password</a></p>

    <p>After setting your password, you'll be able to:</p>
    <ul>
      <li>Access your member dashboard</li>
      <li>Claim your existing profile</li>
      <li>Manage your membership information</li>
      <li>And more!</li>
    </ul>

    <p>If you have any questions, please don't hesitate to reach out.</p>

    <p>Best regards,<br>
    Rochester Doula Cooperative</p>
  `;
}

/**
 * Send an invitation email to a member to claim their subscription.
 * Creates a Firebase Auth user and minimal member document, then sends
 * a password reset email so the user can set their password and log in.
 *
 * Flow:
 * 1. Validate unclaimed profile exists
 * 2. Create Firebase Auth user (or use existing)
 * 3. Create minimal member document
 * 4. Set admin claim if applicable
 * 5. Generate password reset link and send email
 * 6. User clicks link, sets password, logs in
 * 7. User claims their profile (transfers data from unclaimed profile)
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

  const firestore = getFirestore();
  const auth = getAuth();

  try {
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
    const unclaimedProfile = {
      ...unclaimedProfileData,
      email,
    } as UnclaimedProfileDocumentData & { email: string };

    const now = Timestamp.now();
    let userRecord: UserRecord;
    let isNewUser = false;
    const warningMessages: string[] = [];

    // Step 1: Create Firebase Auth user (or check if exists)
    try {
      const temporaryPassword = generateSecurePassword();
      userRecord = await auth.createUser({
        email,
        emailVerified: true, // Clicking password reset link proves email ownership
        password: temporaryPassword,
        ...(unclaimedProfile.name && { displayName: unclaimedProfile.name }),
      });
      isNewUser = true;
      logger.info("Created Firebase Auth user for invitation", {
        uid: userRecord.uid,
        email,
      });
    } catch (error: unknown) {
      // Handle Firebase Auth errors specifically
      if (error && typeof error === "object" && "code" in error) {
        const firebaseError = error as { code: string; message?: string };

        switch (firebaseError.code) {
          case "auth/email-already-in-use": {
            // User already exists - expected, continue with lookup
            try {
              userRecord = await auth.getUserByEmail(email);
              logger.info("User already exists, will send password reset", {
                uid: userRecord.uid,
                email,
              });
            } catch (lookupError) {
              logger.error("Failed to look up existing user", {
                errorId: ERROR_IDS.ADMIN_SEND_INVITATION_AUTH_LOOKUP_FAILED,
                error: lookupError,
                email,
              });
              throw new HttpError(
                "User exists but could not be looked up. Please try again.",
                500,
              );
            }
            break;
          }

          case "auth/operation-not-allowed": {
            // Operation not allowed - configuration issue
            logger.error("Firebase Auth email/password provider not enabled", {
              errorId: ERROR_IDS.ADMIN_SEND_INVITATION_AUTH_CREATE_FAILED,
              error,
              errorCode: firebaseError.code,
              email,
              severity: "CRITICAL",
              actionRequired:
                "Enable email/password authentication in Firebase Console",
            });
            throw new HttpError(
              "User account creation is not available. Please contact support.",
              503,
            );
          }

          case "auth/insufficient-permission": {
            // Insufficient permissions - IAM issue
            logger.error(
              "Insufficient permissions to create Firebase Auth user",
              {
                errorId: ERROR_IDS.ADMIN_SEND_INVITATION_AUTH_CREATE_FAILED,
                error,
                errorCode: firebaseError.code,
                email,
                severity: "CRITICAL",
                actionRequired:
                  "Check Firebase Functions service account permissions",
              },
            );
            throw new HttpError(
              "Unable to create user account due to permission issue. Please contact support.",
              500,
            );
          }

          default: {
            // All other Firebase Auth errors
            logger.error(
              "Firebase Auth createUser failed with specific error code",
              {
                errorId: ERROR_IDS.ADMIN_SEND_INVITATION_AUTH_CREATE_FAILED,
                error,
                errorCode: firebaseError.code,
                errorMessage: firebaseError.message,
                email,
              },
            );
            throw new HttpError(
              `Failed to create user account: ${firebaseError.message ?? "Unknown Firebase Auth error"}`,
              500,
            );
          }
        }
      } else {
        // Unexpected error type (not a Firebase error)
        logger.error("Unexpected non-Firebase error creating auth user", {
          errorId: ERROR_IDS.ADMIN_SEND_INVITATION_AUTH_CREATE_FAILED,
          error,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          errorType: error?.constructor?.name,
          email,
        });
        throw new HttpError("Failed to create user account.", 500);
      }
    }

    // Step 2: Create minimal member document (if new user)
    if (isNewUser) {
      const memberReference = firestore
        .collection(MEMBERS_COLLECTION)
        .doc(userRecord.uid);

      const memberDocument: MemberDocument = {
        uid: userRecord.uid,
        email,
        createdAt: now,
        membershipActive: false, // Will be set true when they claim profile
      };

      try {
        await memberReference.set(memberDocument);
        logger.info("Created minimal member document for invited user", {
          uid: userRecord.uid,
          email,
        });
      } catch (memberError) {
        // Member doc creation failed - clean up by deleting the auth user
        logger.error(
          "Failed to create member document, cleaning up auth user",
          {
            errorId: ERROR_IDS.ADMIN_SEND_INVITATION_MEMBER_DOC_FAILED,
            error: memberError,
            uid: userRecord.uid,
            email,
          },
        );

        try {
          await auth.deleteUser(userRecord.uid);
          logger.info("Cleaned up auth user after member doc failure", {
            uid: userRecord.uid,
            email,
          });
        } catch (cleanupError) {
          logger.error(
            "CRITICAL: Failed to clean up auth user after member doc failure",
            {
              errorId: ERROR_IDS.ADMIN_SEND_INVITATION_CLEANUP_FAILED,
              error: cleanupError,
              uid: userRecord.uid,
              email,
              severity: "CRITICAL",
              actionRequired:
                "Manually delete orphaned auth user or retry invitation",
            },
          );
        }

        throw new HttpError(
          "Failed to create member record. Please try again.",
          500,
        );
      }
    }

    // Step 3: Set admin claim if email matches admin email
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (isAdmin) {
      try {
        await auth.setCustomUserClaims(userRecord.uid, { admin: true });
        logger.info("Auto-granted admin claim to invited user", {
          uid: userRecord.uid,
          email,
        });
      } catch (claimError) {
        logger.error("Failed to set admin claim for invited user", {
          errorId: ERROR_IDS.ADMIN_SEND_INVITATION_CLAIM_FAILED,
          error: claimError,
          errorMessage:
            claimError instanceof Error ? claimError.message : "Unknown error",
          uid: userRecord.uid,
          email,
          severity: "HIGH",
          actionRequired:
            "Manually set admin claim via Firebase Console or retry",
        });

        // Track failure in Firestore for recovery
        try {
          await firestore
            .collection(MEMBERS_COLLECTION)
            .doc(userRecord.uid)
            .set(
              {
                adminClaimStatus: "pending",
                adminClaimError:
                  claimError instanceof Error
                    ? claimError.message
                    : "Unknown error",
                adminClaimFailedAt: now,
              },
              { merge: true },
            );
        } catch (trackingError) {
          logger.error("Failed to track admin claim failure in Firestore", {
            errorId: ERROR_IDS.ADMIN_SEND_INVITATION_TRACKING_FAILED,
            error: trackingError,
            uid: userRecord.uid,
            email,
          });
        }

        // Include warning in response so admin knows claim failed
        warningMessages.push(
          "Admin claim could not be set automatically. Please verify admin access after user signs in.",
        );
      }
    }

    // Step 4: Generate password reset link
    let passwordResetLink: string;
    try {
      passwordResetLink = await auth.generatePasswordResetLink(email, {
        url: "https://members.doulacooperative.com/membership",
      });
    } catch (linkError) {
      logger.error("Failed to generate password reset link", {
        errorId: ERROR_IDS.ADMIN_SEND_INVITATION_RESET_LINK_FAILED,
        error: linkError,
        uid: userRecord.uid,
        email,
      });
      throw new HttpError(
        "Failed to generate password reset link. Please try again.",
        500,
      );
    }

    // Step 5: Build and send invitation email with password reset link
    const subscriptionStartDate =
      unclaimedProfile.subscriptionStart?.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }) ?? "Unknown start date";

    const memberName = unclaimedProfile.name ?? "Member";

    const emailMessage: EmailMessage = {
      from: `Rochester Doula Cooperative <${NO_REPLY_EMAIL}>`,
      to: email,
      subject: "Set Up Your Rochester Doula Cooperative Account",
      html: generateInvitationEmailHtml({
        memberName,
        subscriptionStartDate,
        passwordResetLink,
      }),
    };

    // Send email via injected EmailService
    // In emulator mode (FUNCTIONS_EMULATOR=true), email sending is automatically skipped
    try {
      await emailService.sendEmail({ message: emailMessage }, logger);
      logger.info(
        "Invitation email with password reset link sent successfully",
        {
          email,
          uid: userRecord.uid,
        },
      );
    } catch (error) {
      logger.error("Failed to send invitation email", {
        error,
        errorId: ERROR_IDS.ADMIN_SEND_INVITATION_EMAIL_FAILED,
        email,
        uid: userRecord.uid,
        severity: "HIGH",
        actionRequired:
          "User was NOT notified - send manual notification or retry",
      });

      // Track email failure in Firestore (handle cascading failure)
      try {
        await unclaimedProfileReference.update({
          invitationEmailStatus: "failed",
          invitationEmailError:
            error instanceof Error ? error.message : "Unknown error",
          invitationEmailFailedAt: now,
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
              firestoreError instanceof Error
                ? firestoreError.stack
                : undefined,
            originalEmailError: error,
            originalEmailErrorMessage:
              error instanceof Error ? error.message : "Unknown error",
            originalEmailErrorStack:
              error instanceof Error ? error.stack : undefined,
            originalEmailErrorType: error?.constructor?.name,
            email,
            uid: userRecord.uid,
            severity: "CRITICAL",
            context: "Cascading failure - email failed AND tracking failed",
          },
        );
        // Still throw the original email error to user (Firestore failure is logged)
      }

      // THROW - Do not return success when email failed
      // User needs to be notified manually or admin needs to retry
      throw new HttpError(
        "User account created but invitation email failed to send. Please retry or contact the user directly.",
        500,
      );
    }

    // Update unclaimed profile with invitation tracking
    try {
      await unclaimedProfileReference.update({
        invitationEmailStatus: "sent",
        invitationEmailSentAt: now,
        invitationEmailError: FieldValue.delete(),
        invitedUserUid: userRecord.uid,
      });

      logger.info("Invitation sent and tracked successfully", {
        email,
        uid: userRecord.uid,
      });

      return {
        success: true,
        ...(warningMessages.length > 0 && {
          warning: warningMessages.join(" "),
        }),
      };
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
          uid: userRecord.uid,
        },
      );

      // Add tracking failure to warnings
      warningMessages.push(
        "Invitation sent but tracking update failed. The email was delivered successfully.",
      );

      // Return partial success with all warnings
      return {
        success: true,
        warning: warningMessages.join(" "),
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
