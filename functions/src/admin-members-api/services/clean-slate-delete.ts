import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/index.js";
import { deleteProfile } from "../../profiles-api/services/profile-store/delete-profile.js";
import { deleteProfileImage } from "../../profiles-api/services/imagekit/delete-profile-image.js";
import {
  ForbiddenError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import { MemberFirestoreService } from "../../shared-api/services/member-firestore/index.js";
import { removeNewsletterSubscriber } from "../../shared-api/utils/mailerlite.js";
import { sendAdminFailureNotification } from "../../shared-api/utils/send-admin-failure-notification.js";
import { updateProfileWithRebuild } from "../../shared-api/utils/update-profile-with-rebuild.js";
import { cancelStripeSubscription } from "../../stripe-webhook-api/services/cancel-stripe-subscription.js";
import { deleteStripeCustomer } from "../../stripe-webhook-api/services/delete-stripe-customer.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Result of a clean slate delete operation.
 */
export interface CleanSlateResult {
  deletedUid: string;
  subscriptionCanceled?: boolean;
  stripeCustomerDeleted?: boolean;
  newsletterUnsubscribed?: boolean;
  profileDeleted?: boolean;
  profileImageDeleted?: boolean;
  memberDocumentDeleted: boolean;
  authUserDeleted: boolean;
  warning?: string;
}

interface FirebaseAuthError {
  code: string;
  message: string;
}

function isAuthError(error: unknown): error is FirebaseAuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as FirebaseAuthError).code === "string"
  );
}

/**
 * Clean slate delete: remove every trace of a user across all integrated systems.
 * Primarily for testing purposes — removes Stripe, MailerLite, Firestore profile, ImageKit, Firestore member, and Auth.
 *
 * Order:
 *   1. Read member document (verify exists)
 *   2. Prevent self-deletion and admin-deletion
 *   3. NON-CRITICAL: Cancel Stripe subscription (if exists)
 *   4. NON-CRITICAL: Delete Stripe customer (if exists)
 *   5. NON-CRITICAL: Unsubscribe from MailerLite (if subscribed)
 *   6. NON-CRITICAL: Delete Hugo profile (if slug exists)
 *   6b. NON-CRITICAL: Delete ImageKit profile image (if slug exists)
 *   7. CRITICAL: Delete Firestore member document
 *   8. CRITICAL: Delete Firebase Auth user
 */
export async function cleanSlateDelete({
  memberId,
  requestingAdminUid,
  emailService,
}: {
  memberId: string;
  requestingAdminUid: string;
  emailService?: EmailServiceInterface;
}): Promise<CleanSlateResult> {
  // Step 1: Verify member exists
  const member = await verifyMemberExists(memberId);

  // Step 2: Prevent self-deletion
  if (requestingAdminUid === memberId) {
    throw new ForbiddenError("You cannot delete your own account");
  }

  // Step 2b: Prevent deleting another admin
  const auth = getAuth();
  let targetUser;
  try {
    targetUser = await auth.getUser(memberId);
  } catch (error) {
    // If Auth user doesn't exist, continue — we still want to clean up Firestore
    if (isAuthError(error) && error.code === "auth/user-not-found") {
      logger.warn("Auth user not found during clean slate delete", {
        memberId,
      });
      targetUser = undefined;
    } else {
      throw error;
    }
  }

  if (targetUser?.customClaims?.["admin"] === true) {
    throw new ForbiddenError(
      "Cannot delete admin users. Remove admin privileges first.",
    );
  }

  // Step 2c: Block deletion of members with active subscriptions
  if (member.membershipActive === true) {
    throw new ValidationError(
      "Cannot clean slate delete a member with an active subscription. Refund or cancel the membership first.",
    );
  }

  const failures: string[] = [];

  // Step 3: NON-CRITICAL — Cancel Stripe subscription
  let subscriptionCanceled: boolean | undefined;
  if (
    member.stripeSubscriptionId !== undefined &&
    member.stripeSubscriptionId.length > 0
  ) {
    try {
      await cancelStripeSubscription({
        subscriptionId: member.stripeSubscriptionId,
      });
      logger.info("Stripe subscription canceled during clean slate delete", {
        memberId,
        stripeSubscriptionId: member.stripeSubscriptionId,
      });
      subscriptionCanceled = true;
    } catch (error) {
      subscriptionCanceled = false;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        "Failed to cancel Stripe subscription during clean slate delete",
        {
          errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_STRIPE_CANCEL_FAILED,
          memberId,
          stripeSubscriptionId: member.stripeSubscriptionId,
          error,
          errorMessage,
        },
      );
      failures.push(
        `Cancel Stripe subscription (${member.stripeSubscriptionId}): ${errorMessage}`,
      );
    }
  }

  // Step 4: NON-CRITICAL — Delete Stripe customer
  let stripeCustomerDeleted: boolean | undefined;
  if (
    member.stripeCustomerId !== undefined &&
    member.stripeCustomerId.length > 0
  ) {
    try {
      await deleteStripeCustomer({ customerId: member.stripeCustomerId });
      logger.info("Stripe customer deleted during clean slate delete", {
        memberId,
        stripeCustomerId: member.stripeCustomerId,
      });
      stripeCustomerDeleted = true;
    } catch (error) {
      stripeCustomerDeleted = false;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        "Failed to delete Stripe customer during clean slate delete",
        {
          errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_STRIPE_DELETE_FAILED,
          memberId,
          stripeCustomerId: member.stripeCustomerId,
          error,
          errorMessage,
        },
      );
      failures.push(
        `Delete Stripe customer (${member.stripeCustomerId}): ${errorMessage}`,
      );
    }
  }

  // Step 5: NON-CRITICAL — Unsubscribe from MailerLite newsletter
  let newsletterUnsubscribed: boolean | undefined;
  if (member.newsletterSubscribed === true) {
    const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];
    if (mailerliteApiKey) {
      try {
        await removeNewsletterSubscriber({
          email: member.email,
          apiKey: mailerliteApiKey,
        });
        logger.info("Unsubscribed from newsletter during clean slate delete", {
          memberId,
          email: member.email,
        });
        newsletterUnsubscribed = true;
      } catch (error) {
        newsletterUnsubscribed = false;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          "Failed to unsubscribe from newsletter during clean slate delete",
          {
            errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_NEWSLETTER_FAILED,
            memberId,
            email: member.email,
            error,
            errorMessage,
          },
        );
        failures.push(
          `Newsletter unsubscribe (${member.email}): ${errorMessage}`,
        );
      }
    } else {
      logger.warn(
        "MAILERLITE_API_KEY not configured, skipping newsletter unsubscribe",
        { memberId, email: member.email },
      );
      failures.push(
        "Newsletter unsubscribe skipped: MAILERLITE_API_KEY not configured",
      );
    }
  }

  // Step 6: NON-CRITICAL — Delete Hugo profile
  let profileDeleted: boolean | undefined;
  if (member.slug !== undefined && member.slug.length > 0) {
    profileDeleted = await updateProfileWithRebuild({
      slug: member.slug,
      action: "clean slate delete",
      actionLabel: "Delete profile",
      profileAction: deleteProfile,
      errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_DELETE_PROFILE_FAILED,
      memberId,
      failures,
    });
  }

  // Step 6b: NON-CRITICAL — Delete ImageKit profile image
  let profileImageDeleted: boolean | undefined;
  if (member.slug !== undefined && member.slug.length > 0) {
    try {
      const imageResult = await deleteProfileImage({ slug: member.slug });
      logger.info("ImageKit profile image cleanup during clean slate delete", {
        memberId,
        slug: member.slug,
        deleted: imageResult.deleted,
      });
      profileImageDeleted = imageResult.deleted;
    } catch (error) {
      profileImageDeleted = false;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to delete profile image during clean slate delete", {
        errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_IMAGE_DELETE_FAILED,
        memberId,
        slug: member.slug,
        error,
        errorMessage,
      });
      failures.push(
        `Delete profile image (slug: ${member.slug}): ${errorMessage}`,
      );
    }
  }

  // NON-CRITICAL: Send admin notification if any cascading action failed
  if (failures.length > 0 && emailService !== undefined) {
    await sendAdminFailureNotification({
      subject: "Clean Slate Delete - Action Required for Failed Follow-up Actions",
      title: "Clean Slate Delete - Cascading Action Failures",
      description: "A clean slate delete was performed, but some follow-up actions failed.",
      email: member.email,
      memberId,
      failures,
      errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_NOTIFICATION_FAILED,
      emailService,
    });
  }

  // Step 7: CRITICAL — Delete Firestore member document
  try {
    await MemberFirestoreService.deleteMember(memberId);
  } catch (error) {
    logger.error(
      "CRITICAL: Failed to delete Firestore member document during clean slate delete",
      {
        errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_FAILED,
        memberId,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedSteps: {
          subscriptionCanceled,
          stripeCustomerDeleted,
          newsletterUnsubscribed,
          profileDeleted,
          profileImageDeleted,
        },
      },
    );
    throw error;
  }

  // Step 8: CRITICAL — Delete Firebase Auth user
  let authUserDeleted = false;
  try {
    await auth.deleteUser(memberId);
    authUserDeleted = true;
  } catch (error) {
    if (isAuthError(error) && error.code === "auth/user-not-found") {
      // User is already gone — desired state achieved
      authUserDeleted = true;
      logger.warn(
        "Auth user not found during clean slate delete (already removed)",
        { memberId },
      );
    } else {
      logger.error(
        "CRITICAL: Failed to delete Auth user during clean slate delete",
        {
          errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_FAILED,
          memberId,
          error,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          completedSteps: {
            subscriptionCanceled,
            stripeCustomerDeleted,
            newsletterUnsubscribed,
            profileDeleted,
            profileImageDeleted,
            memberDocumentDeleted: true,
          },
        },
      );
      throw error;
    }
  }

  const warning =
    failures.length > 0
      ? `Non-critical actions failed: ${failures.join("; ")}`
      : undefined;

  return {
    deletedUid: memberId,
    ...(subscriptionCanceled !== undefined && { subscriptionCanceled }),
    ...(stripeCustomerDeleted !== undefined && { stripeCustomerDeleted }),
    ...(newsletterUnsubscribed !== undefined && { newsletterUnsubscribed }),
    ...(profileDeleted !== undefined && { profileDeleted }),
    ...(profileImageDeleted !== undefined && { profileImageDeleted }),
    memberDocumentDeleted: true,
    authUserDeleted,
    ...(warning !== undefined && { warning }),
  };
}
