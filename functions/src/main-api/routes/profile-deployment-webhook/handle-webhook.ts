import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../../shared-api/errors/http-error.js";
import type { ProfileWebhookService } from "../../services/profile-webhook/index.js";
import type { Logger } from "../../../shared-api/types/logger.js";

interface WebhookResponse {
  received: boolean;
  notified: boolean;
  reason?: string;
  emulator?: boolean;
}

export async function handleProfileWebhookLogic({
  payload,
  webhookSecret,
  mailgunApiKey,
  profileWebhookService,
  logger,
  set,
}: {
  payload: {
    commitMessage?: string;
    commitSha?: string;
    slug?: string;
    secret?: string;
  };
  webhookSecret: string;
  mailgunApiKey: string;
  profileWebhookService: typeof ProfileWebhookService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<WebhookResponse | { error: string }> {
  try {
    // Validate secret
    if (!payload.secret) {
      logger.warn("Webhook called without secret", {
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET,
      });
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (!profileWebhookService.verifySecret({ provided: payload.secret, expected: webhookSecret })) {
      logger.warn("Invalid webhook secret", {
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET,
      });
      set.status = 401;
      return { error: "Unauthorized" };
    }

    // Validate payload
    const validation = profileWebhookService.validatePayload({ payload });

    if (!validation.isValid) {
      logger.info("Webhook received but not processing", {
        reason: validation.reason,
        commitMessage: payload.commitMessage,
        commitSha: payload.commitSha,
      });
      set.status = 200;
      return {
        received: true,
        notified: false,
        ...(validation.reason !== undefined && { reason: validation.reason }),
      };
    }

    const { commitMessage, commitSha, slug } = payload;

    // Type assertion safe here: validation.isValid guarantees these exist
    if (!commitMessage || !commitSha || !slug) {
      set.status = 500;
      return { error: "Validation passed but payload incomplete" };
    }

    // Find member by slug
    const member = await profileWebhookService.findMemberBySlug({ slug, logger });

    if (!member) {
      logger.warn("Member not found for profile update notification", {
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_MEMBER_NOT_FOUND,
        slug,
        commitSha,
      });
      set.status = 200;
      return {
        received: true,
        notified: false,
        reason: "member_not_found",
      };
    }

    // Send notification email (skip in emulator mode)
    if (process.env["FUNCTIONS_EMULATOR"]) {
      logger.info("Emulator detected, skipping email dispatch");
      logger.info("Would have sent profile update notification", {
        to: member.email,
        slug,
      });
      set.status = 200;
      return {
        received: true,
        notified: true,
        emulator: true,
      };
    }

    try {
      await profileWebhookService.sendNotificationEmail({
        memberEmail: member.email,
        memberName: member.name,
        slug: member.slug,
        commitMessage,
        mailgunApiKey,
      });

      logger.info("Profile update notification sent", {
        email: member.email,
        slug,
        commitSha,
      });

      set.status = 200;
      return {
        received: true,
        notified: true,
      };
    } catch (emailError) {
      logger.error("Failed to send profile update notification", {
        error: emailError,
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_EMAIL_FAILED,
        email: member.email,
        slug,
        commitSha,
      });
      set.status = 200;
      return {
        received: true,
        notified: false,
        reason: "email_failed",
      };
    }
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to process profile webhook", {
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_PROCESSING_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    set.status = 500;
    return { error: "Internal server error" };
  }
}
