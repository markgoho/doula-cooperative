import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/index.js";
import { draftProfile } from "../../profiles-api/services/profile-store/draft-profile.js";
import { triggerHugoRebuild } from "../../profiles-api/services/profile-store/trigger-rebuild.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import { updateMemberWithValidation } from "../../shared-api/utils/firestore-helpers.js";
import { removeNewsletterSubscriber } from "../../shared-api/utils/mailerlite.js";
import { sendAdminFailureNotification } from "../../shared-api/utils/send-admin-failure-notification.js";
import type { MemberDocument } from "../../types/member-document.js";
import { findMemberByStripeCustomer } from "./find-member-by-stripe-customer.js";

/**
 * Result of processing a subscription ended event.
 */
export interface SubscriptionEndedResult {
  memberId?: string;
  memberFound: boolean;
  memberDeactivated: boolean;
  profileDrafted?: boolean;
  newsletterUnsubscribed?: boolean;
  warning?: string;
}

/**
 * Process a customer.subscription.deleted Stripe webhook event.
 *
 * Triggered when a subscription's billing period ends after cancellation,
 * or when a subscription is immediately canceled.
 *
 * CRITICAL: Deactivate member document (sets membershipActive=false, membershipExpiresAt=now)
 * NON-CRITICAL: Draft Hugo profile (if member has slug), unsubscribe from newsletter, admin notification on failure
 */
export async function processSubscriptionEnded({
  stripeCustomerId,
  emailService,
}: {
  stripeCustomerId: string;
  emailService?: EmailServiceInterface;
}): Promise<SubscriptionEndedResult> {
  // Step 1: Find member by Stripe customer ID
  let member: MemberDocument | undefined;
  try {
    member = await findMemberByStripeCustomer({ stripeCustomerId });
  } catch (error) {
    logger.error("Failed to look up member for subscription end", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_MEMBER_LOOKUP_FAILED,
      stripeCustomerId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  if (!member) {
    logger.info(
      "No member found for Stripe customer ID during subscription end",
      {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_MEMBER_NOT_FOUND,
        stripeCustomerId,
      },
    );
    return {
      memberFound: false,
      memberDeactivated: false,
    };
  }

  // Idempotency: Skip if already refunded or already deactivated
  if (
    member.subscriptionStatus === "refunded" ||
    member.membershipActive === false
  ) {
    logger.info(
      "Member already deactivated or refunded, skipping subscription end actions",
      {
        memberId: member.uid,
        subscriptionStatus: member.subscriptionStatus,
        membershipActive: member.membershipActive,
      },
    );
    return {
      memberId: member.uid,
      memberFound: true,
      memberDeactivated: true,
    };
  }

  // CRITICAL: Deactivate member
  const now = Timestamp.now();
  const deactivationUpdates: Partial<MemberDocument> = {
    membershipActive: false,
    membershipExpiresAt: now,
    ...(member.subscriptionStatus !== "canceled" && {
      subscriptionStatus: "canceled" as const,
    }),
  };

  try {
    await updateMemberWithValidation({
      memberId: member.uid,
      updates: deactivationUpdates,
      operation: "deactivate subscription end",
    });
  } catch (error) {
    logger.error(
      "CRITICAL: Failed to deactivate member during subscription end",
      {
        errorId:
          ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_DEACTIVATION_FAILED,
        memberId: member.uid,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    );
    throw error;
  }

  const failures: string[] = [];

  // NON-CRITICAL: Draft Hugo profile if member has a slug
  let profileDrafted: boolean | undefined;
  if (member.slug !== undefined && member.slug.length > 0) {
    try {
      await draftProfile({ slug: member.slug });
      logger.info("Set Hugo profile to draft after subscription end", {
        memberId: member.uid,
        slug: member.slug,
      });
      profileDrafted = true;

      // NON-CRITICAL: Trigger Hugo rebuild after drafting
      try {
        await triggerHugoRebuild({ slug: member.slug, action: "subscription ended" });
      } catch (rebuildError: unknown) {
        const rebuildErrorMessage =
          rebuildError instanceof Error ? rebuildError.message : "Unknown error";
        logger.error("Failed to trigger Hugo rebuild after subscription end draft", {
          memberId: member.uid,
          slug: member.slug,
          error: rebuildError,
          errorMessage: rebuildErrorMessage,
        });
      }
    } catch (error) {
      profileDrafted = false;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to draft profile during subscription end", {
        errorId:
          ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_DRAFT_PROFILE_FAILED,
        memberId: member.uid,
        slug: member.slug,
        error,
        errorMessage,
      });
      failures.push(`Draft profile (slug: ${member.slug}): ${errorMessage}`);
    }
  }

  // NON-CRITICAL: Unsubscribe from newsletter if subscribed
  let newsletterUnsubscribed: boolean | undefined;
  if (member.newsletterSubscribed === true) {
    const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];
    if (mailerliteApiKey) {
      try {
        await removeNewsletterSubscriber({
          email: member.email,
          apiKey: mailerliteApiKey,
        });
        await updateMemberWithValidation({
          memberId: member.uid,
          updates: {
            newsletterSubscribed: false,
            newsletterUnsubscribedAt: Timestamp.now(),
          },
          operation: "update member",
        });
        logger.info("Unsubscribed from newsletter after subscription end", {
          memberId: member.uid,
          email: member.email,
        });
        newsletterUnsubscribed = true;
      } catch (error) {
        newsletterUnsubscribed = false;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          "Failed to unsubscribe from newsletter during subscription end",
          {
            errorId:
              ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_NEWSLETTER_FAILED,
            memberId: member.uid,
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
        { memberId: member.uid, email: member.email },
      );
      failures.push(
        "Newsletter unsubscribe skipped: MAILERLITE_API_KEY not configured",
      );
    }
  }

  // NON-CRITICAL: Send admin notification if any cascading action failed
  if (failures.length > 0 && emailService !== undefined) {
    await sendAdminFailureNotification({
      subject: "Subscription End - Action Required for Failed Follow-up Actions",
      title: "Subscription End - Cascading Action Failures",
      description: "A subscription ended, but some follow-up actions failed.",
      email: member.email,
      memberId: member.uid,
      failures,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_NOTIFICATION_FAILED,
      emailService,
    });
  }

  const warning =
    failures.length > 0
      ? `Non-critical actions failed: ${failures.join("; ")}`
      : undefined;

  return {
    memberId: member.uid,
    memberFound: true,
    memberDeactivated: true,
    ...(profileDrafted !== undefined && { profileDrafted }),
    ...(newsletterUnsubscribed !== undefined && { newsletterUnsubscribed }),
    ...(warning !== undefined && { warning }),
  };
}
