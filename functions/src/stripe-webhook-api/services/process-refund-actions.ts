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
import { buildRefundNotificationEmail } from "./build-refund-notification-email.js";

/**
 * Result of processing refund actions for a member.
 */
export interface RefundActionsResult {
  memberDeactivated: boolean;
  profileDrafted?: boolean;
  newsletterUnsubscribed?: boolean;
  memberNotified?: boolean;
  warning?: string;
}

/**
 * Process the cascading actions required after a membership refund.
 *
 * CRITICAL: Deactivate member document (sets membershipActive=false, subscriptionStatus="refunded")
 * NON-CRITICAL: Draft Hugo profile (if member has slug), unsubscribe from newsletter, send admin notification on failure
 */
export async function processRefundActions({
  memberId,
  member,
  reason,
  emailService,
}: {
  memberId: string;
  member: MemberDocument;
  reason?: string;
  emailService?: EmailServiceInterface;
}): Promise<RefundActionsResult> {
  // Idempotency check: if member is already refunded, skip
  if (member.subscriptionStatus === "refunded") {
    logger.info("Member already refunded, skipping refund actions", {
      memberId,
    });
    return { memberDeactivated: true };
  }

  // CRITICAL: Update member document
  const now = Timestamp.now();
  const refundUpdates: Partial<MemberDocument> = {
    membershipActive: false,
    subscriptionStatus: "refunded",
    refundedAt: now,
    membershipExpiresAt: now,
    ...(reason !== undefined && { refundReason: reason }),
  };

  try {
    await updateMemberWithValidation({
      memberId,
      updates: refundUpdates,
      operation: "refund membership",
    });
  } catch (error) {
    logger.error("CRITICAL: Failed to deactivate member during refund", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_DEACTIVATION_FAILED,
      memberId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  const failures: string[] = [];

  // NON-CRITICAL: Draft Hugo profile if member has a slug
  let profileDrafted: boolean | undefined;
  if (member.slug !== undefined && member.slug.length > 0) {
    try {
      await draftProfile({ slug: member.slug });
      logger.info("Set Hugo profile to draft after refund", {
        memberId,
        slug: member.slug,
      });
      profileDrafted = true;

      // NON-CRITICAL: Trigger Hugo rebuild after drafting
      try {
        await triggerHugoRebuild({ slug: member.slug, action: "refund" });
      } catch (rebuildError: unknown) {
        const rebuildErrorMessage =
          rebuildError instanceof Error ? rebuildError.message : "Unknown error";
        logger.error("Failed to trigger Hugo rebuild after refund draft", {
          memberId,
          slug: member.slug,
          error: rebuildError,
          errorMessage: rebuildErrorMessage,
        });
      }
    } catch (error) {
      profileDrafted = false;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to draft profile during refund", {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_DRAFT_PROFILE_FAILED,
        memberId,
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
          memberId,
          updates: {
            newsletterSubscribed: false,
            newsletterUnsubscribedAt: Timestamp.now(),
          },
          operation: "update member",
        });
        logger.info("Unsubscribed from newsletter after refund", {
          memberId,
          email: member.email,
        });
        newsletterUnsubscribed = true;
      } catch (error) {
        newsletterUnsubscribed = false;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error("Failed to unsubscribe from newsletter during refund", {
          errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_NEWSLETTER_FAILED,
          memberId,
          email: member.email,
          error,
          errorMessage,
        });
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

  // NON-CRITICAL: Send refund confirmation email to member
  let memberNotified: boolean | undefined;
  if (emailService !== undefined) {
    try {
      const memberNotificationEmail = buildRefundNotificationEmail({
        memberEmail: member.email,
        ...(member.name !== undefined && { memberName: member.name }),
      });

      await emailService.sendEmail(
        { message: memberNotificationEmail },
        logger,
      );
      logger.info("Sent refund notification email to member", {
        memberId,
        email: member.email,
      });
      memberNotified = true;
    } catch (error) {
      memberNotified = false;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to send refund notification email to member", {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_MEMBER_NOTIFICATION_FAILED,
        memberId,
        email: member.email,
        error,
        errorMessage,
      });
      failures.push(
        `Member refund notification (${member.email}): ${errorMessage}`,
      );
    }
  }

  // NON-CRITICAL: Send admin notification if any cascading action failed
  if (failures.length > 0 && emailService !== undefined) {
    await sendAdminFailureNotification({
      subject: "Refund Processing - Action Required for Failed Follow-up Actions",
      title: "Refund Processing - Cascading Action Failures",
      description: "A membership refund was processed, but some follow-up actions failed.",
      email: member.email,
      memberId,
      failures,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_NOTIFICATION_FAILED,
      emailService,
    });
  }

  const warning =
    failures.length > 0
      ? `Non-critical actions failed: ${failures.join("; ")}`
      : undefined;

  return {
    memberDeactivated: true,
    ...(profileDrafted !== undefined && { profileDrafted }),
    ...(newsletterUnsubscribed !== undefined && { newsletterUnsubscribed }),
    ...(memberNotified !== undefined && { memberNotified }),
    ...(warning !== undefined && { warning }),
  };
}
