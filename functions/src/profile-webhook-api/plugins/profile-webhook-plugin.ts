import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { EmailService } from "../../shared-api/services/email/index.js";
import { handleProfileWebhookLogic } from "../routes/handle-webhook.js";
import {
  ProfileWebhookBodySchema,
  ProfileWebhookResponseSchema,
} from "../schemas/profile-webhook-schemas.js";
import { ProfileWebhookService } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create profile webhook plugin.
 *
 * This plugin handles profile deployment notifications at POST /.
 * It verifies webhook secrets and sends email notifications to members when their profile is updated.
 *
 * Firebase rewrite: /api/profile-webhook → profileWebhookApi function
 * Plugin routes start from "/" - Firebase already provides /api/profile-webhook prefix
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with profile webhook route
 */
export function createProfileWebhookPlugin(services?: PartialServices) {
  return new Elysia({ name: "profile-webhook" })
    .decorate(
      SERVICE_KEYS.PROFILE_WEBHOOK_SERVICE,
      services?.profileWebhookService ?? ProfileWebhookService,
    )
    .decorate(
      SERVICE_KEYS.EMAIL_SERVICE,
      services?.emailService ?? EmailService,
    )
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .post(
      "/",
      async ({ body, profileWebhookService, emailService, logger, set }) => {
        const webhookSecret = process.env["DEPLOY_WEBHOOK_SECRET"];

        if (!webhookSecret) {
          logger.error("DEPLOY_WEBHOOK_SECRET not configured");
          set.status = 500;
          return { status: "error", error: "Server configuration error" };
        }

        return handleProfileWebhookLogic({
          payload: body,
          webhookSecret,
          profileWebhookService,
          emailService,
          logger,
          set,
        });
      },
      {
        body: ProfileWebhookBodySchema,
        response: ProfileWebhookResponseSchema,
      },
    );
}
