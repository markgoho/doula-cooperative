import { ERROR_IDS } from "@doula-coop/functions-shared/constants/index.js";
import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import { updateMemberWithValidation } from "@doula-coop/functions-shared/shared-api/utils/firestore-helpers.js";
import { sendAdminFailureNotification } from "@doula-coop/functions-shared/shared-api/utils/send-admin-failure-notification.js";
import { unsubscribeNewsletter } from "@doula-coop/functions-shared/shared-api/utils/unsubscribe-newsletter.js";
import { updateProfileWithRebuild } from "@doula-coop/functions-shared/shared-api/utils/update-profile-with-rebuild.js";
import type { MemberDocument } from "@doula-coop/functions-shared/types/member-document.js";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { draftProfile } from "../../profiles-api/services/profile-store/draft-profile.js";
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
    profileDrafted = await updateProfileWithRebuild({
      slug: member.slug,
      action: "subscription ended",
      actionLabel: "Draft profile",
      profileAction: draftProfile,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_DRAFT_PROFILE_FAILED,
      memberId: member.uid,
      failures,
    });
  }

  // NON-CRITICAL: Unsubscribe from newsletter if subscribed
  let newsletterUnsubscribed: boolean | undefined;
  if (member.newsletterSubscribed === true) {
    newsletterUnsubscribed = await unsubscribeNewsletter({
      email: member.email,
      memberId: member.uid,
      action: "subscription end",
      errorId: ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_NEWSLETTER_FAILED,
      failures,
    });
  }

  // NON-CRITICAL: Send admin notification if any cascading action failed
  if (failures.length > 0 && emailService !== undefined) {
    await sendAdminFailureNotification({
      subject:
        "Subscription End - Action Required for Failed Follow-up Actions",
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
