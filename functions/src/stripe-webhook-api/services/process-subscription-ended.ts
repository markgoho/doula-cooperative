import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  ERROR_IDS,
  NEWSLETTER_EMAIL,
  NO_REPLY_EMAIL,
} from "../../constants/index.js";
import { draftProfile } from "../../profiles-api/services/github/draft-profile.js";
import { ProfileMemberService } from "../../profiles-api/services/member/index.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import { updateMemberWithValidation } from "../../shared-api/utils/firestore-helpers.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";
import { removeNewsletterSubscriber } from "../../shared-api/utils/mailerlite.js";
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
 * Creates HTML for subscription end failure notification email sent to admin.
 */
function createSubscriptionEndFailureEmailHtml({
  email,
  memberId,
  failures,
}: {
  email: string;
  memberId: string;
  failures: string[];
}): string {
  const failureItems = failures
    .map(failure => `<li>${escapeHtml(failure)}</li>`)
    .join("\n");

  return `
    <h2>Subscription End - Cascading Action Failures</h2>
    <p>A subscription ended, but some follow-up actions failed.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Member ID:</strong> ${escapeHtml(memberId)}</li>
    </ul>

    <h3>Failed Actions:</h3>
    <ul>
      ${failureItems}
    </ul>

    <p><strong>Action Required:</strong> Please manually complete the failed actions above.</p>
  `;
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

    // NON-CRITICAL: Clear cached profile data from Firestore
    try {
      await ProfileMemberService.clearProfileCache(member.uid);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      failures.push(`Clear profile cache: ${errorMessage}`);
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
    try {
      const notificationEmail: EmailMessage = {
        from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
        to: NEWSLETTER_EMAIL,
        subject:
          "Subscription End - Action Required for Failed Follow-up Actions",
        html: createSubscriptionEndFailureEmailHtml({
          email: member.email,
          memberId: member.uid,
          failures,
        }),
      };

      await emailService.sendEmail({ message: notificationEmail }, logger);
      logger.info("Sent subscription end failure notification email", {
        memberId: member.uid,
      });
    } catch (emailError) {
      logger.error(
        "CRITICAL: Failed to send subscription end failure notification email",
        {
          errorId:
            ERROR_IDS.STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_NOTIFICATION_FAILED,
          memberId: member.uid,
          error: emailError,
          severity: "CRITICAL",
          context:
            "Subscription end cascading actions failed AND notification email failed",
          failures,
        },
      );
    }
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
