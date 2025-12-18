import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  ProfileWebhookErrorResponse,
  ProfileWebhookSuccessResponse,
} from "../schemas/profile-webhook-schemas.js";
import type { ProfileWebhookService } from "../services/index.js";

export async function handleProfileWebhookLogic({
  payload,
  webhookSecret,
  profileWebhookService,
  emailService,
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
  profileWebhookService: typeof ProfileWebhookService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ProfileWebhookSuccessResponse | ProfileWebhookErrorResponse> {
  try {
    // Validate secret
    if (!payload.secret) {
      logger.warn("Webhook called without secret", {
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET,
      });
      set.status = 401;
      return { status: "error", error: "Unauthorized" };
    }

    if (
      !profileWebhookService.verifySecret({
        provided: payload.secret,
        expected: webhookSecret,
      })
    ) {
      logger.warn("Invalid webhook secret", {
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET,
      });
      set.status = 401;
      return { status: "error", error: "Unauthorized" };
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
      const response: ProfileWebhookSuccessResponse = {
        status: "success",
        received: true,
        notified: false,
      };

      if (validation.reason !== undefined) {
        response.reason = validation.reason;
      }

      return response;
    }

    const { commitMessage, commitSha, slug } = payload;

    // Type assertion safe here: validation.isValid guarantees these exist
    if (!commitMessage || !commitSha || !slug) {
      set.status = 500;
      return { status: "error", error: "Validation passed but payload incomplete" };
    }

    // Find member by slug
    const member = await profileWebhookService.findMemberBySlug({
      slug,
      logger,
    });

    if (!member) {
      logger.warn("Member not found for profile update notification", {
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_MEMBER_NOT_FOUND,
        slug,
        commitSha,
      });
      set.status = 200;
      return {
        status: "success",
        received: true,
        notified: false,
        reason: "member_not_found",
      };
    }

    // Send notification email (skip in emulator mode)
    if (process.env["FUNCTIONS_EMULATOR"]) {
      logger.info("Emulator mode: Email sending disabled", {
        to: member.email,
        slug,
        message: "Set FUNCTIONS_EMULATOR=false to test email sending",
      });
      set.status = 200;
      return {
        status: "success",
        received: true,
        notified: false,
        reason: "emulator_mode",
      };
    }

    try {
      await profileWebhookService.sendNotificationEmail({
        memberEmail: member.email,
        memberName: member.name,
        slug: member.slug,
        commitMessage,
        emailService,
        logger,
      });

      logger.info("Profile update notification sent", {
        email: member.email,
        slug,
        commitSha,
      });

      set.status = 200;
      return {
        status: "success",
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
        status: "success",
        received: true,
        notified: false,
        reason: "email_failed",
      };
    }
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { status: "error", error: error.message };
    }

    logger.error("Failed to process profile webhook", {
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_PROCESSING_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    set.status = 500;
    return { status: "error", error: "Internal server error" };
  }
}
