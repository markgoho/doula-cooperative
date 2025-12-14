import { Elysia, t } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { handleProfileWebhookLogic } from "../routes/profile-deployment-webhook/handle-webhook.js";
import { ProfileWebhookService } from "../services/profile-webhook/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create profile deployment webhook plugin.
 *
 * This plugin handles profile deployment notifications at POST /profile-deployment-webhook.
 * It verifies webhook secrets and sends email notifications to members when their profile is updated.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with profile webhook route
 */
export function createProfileDeploymentWebhookPlugin(services?: PartialServices) {
  return new Elysia({ name: "profile-deployment-webhook" })
    .decorate(
      SERVICE_KEYS.PROFILE_WEBHOOK_SERVICE,
      services?.profileWebhookService ?? ProfileWebhookService,
    )
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .post(
      "/profile-deployment-webhook",
      async ({ body, profileWebhookService, logger, set }) => {
        const webhookSecret = process.env["DEPLOY_WEBHOOK_SECRET"];
        const mailgunApiKey = process.env["MAILGUN_API_KEY"];

        if (!webhookSecret) {
          logger.error("DEPLOY_WEBHOOK_SECRET not configured");
          set.status = 500;
          return { error: "Server configuration error" };
        }

        if (!mailgunApiKey) {
          logger.error("MAILGUN_API_KEY not configured");
          set.status = 500;
          return { error: "Server configuration error" };
        }

        return handleProfileWebhookLogic({
          payload: body,
          webhookSecret,
          mailgunApiKey,
          profileWebhookService,
          logger,
          set,
        });
      },
      {
        body: t.Object({
          commitMessage: t.Optional(t.String()),
          commitSha: t.Optional(t.String()),
          slug: t.Optional(t.String()),
          secret: t.Optional(t.String()),
        }),
      },
    );
}
