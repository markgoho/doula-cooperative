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
 * Creates HTML for refund failure notification email sent to admin.
 */
function createRefundFailureEmailHtml({
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
    <h2>Refund Processing - Cascading Action Failures</h2>
    <p>A membership refund was processed, but some follow-up actions failed.</p>

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

    // NON-CRITICAL: Clear cached profile data from Firestore
    try {
      await ProfileMemberService.clearProfileCache(memberId);
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
    try {
      const notificationEmail: EmailMessage = {
        from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
        to: NEWSLETTER_EMAIL,
        subject:
          "Refund Processing - Action Required for Failed Follow-up Actions",
        html: createRefundFailureEmailHtml({
          email: member.email,
          memberId,
          failures,
        }),
      };

      await emailService.sendEmail({ message: notificationEmail }, logger);
      logger.info("Sent refund failure notification email", { memberId });
    } catch (emailError) {
      logger.error(
        "CRITICAL: Failed to send refund failure notification email",
        {
          errorId: ERROR_IDS.STRIPE_WEBHOOK_REFUND_NOTIFICATION_FAILED,
          memberId,
          error: emailError,
          severity: "CRITICAL",
          context:
            "Refund cascading actions failed AND notification email failed",
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
    memberDeactivated: true,
    ...(profileDrafted !== undefined && { profileDrafted }),
    ...(newsletterUnsubscribed !== undefined && { newsletterUnsubscribed }),
    ...(memberNotified !== undefined && { memberNotified }),
    ...(warning !== undefined && { warning }),
  };
}
