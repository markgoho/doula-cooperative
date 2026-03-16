import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { HttpError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import type {
  ProfileWebhookErrorResponse,
  ProfileWebhookSuccessResponse,
} from "../schemas/profile-webhook-schemas.js";
import type { ProfileWebhookService } from "../services/index.js";
import type { WebhookPayload } from "../services/types.js";

export async function handleProfileWebhookLogic({
  payload,
  webhookSecret,
  profileWebhookService,
  emailService,
  logger,
  set,
}: {
  payload: WebhookPayload;
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
      logger.info("Webhook received but not processing notification", {
        reason: validation.reason,
        notificationType: payload.notificationType,
      });
      set.status = 200;
      return {
        status: "success",
        received: true,
        notified: false,
        reason: validation.reason,
      };
    }

    const { notificationType, slug } = validation.payload;

    // Find member by slug
    const member = await profileWebhookService.findMemberBySlug({
      slug,
      logger,
    });

    if (!member) {
      logger.warn("Member not found for profile notification", {
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_MEMBER_NOT_FOUND,
        slug,
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
        notificationType,
        emailService,
        logger,
      });

      logger.info("Profile notification sent", {
        email: member.email,
        slug,
      });

      set.status = 200;
      return {
        status: "success",
        received: true,
        notified: true,
      };
    } catch (emailError) {
      logger.error("Failed to send profile notification", {
        error: emailError,
        errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_EMAIL_FAILED,
        email: member.email,
        slug,
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
