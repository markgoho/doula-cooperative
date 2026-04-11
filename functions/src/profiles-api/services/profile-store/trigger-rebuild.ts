import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { GITHUB_OWNER, GITHUB_REPO } from "../../../constants/github-config.js";
import type { ProfileNotificationType } from "../../../profile-webhook-api/services/types.js";
import { HttpError } from "../../../shared-api/errors/http-error.js";
import { getOctokit } from "./get-octokit.js";

/**
 * Trigger a Hugo site rebuild via GitHub repository_dispatch event.
 * Uses the existing GitHub App credentials to dispatch the event.
 * Skips in emulator mode.
 *
 * @param slug - The profile slug
 * @param action - Short description of the action (e.g., "updated profile")
 * @param notificationType - Optional notification type for the deployment webhook.
 *   When provided, the GitHub Actions workflow will POST this to the
 *   profile-webhook endpoint after a successful deploy, triggering a
 *   notification email to the member. Expected values:
 *   - "publish" → first-publish email
 *   - "update" → generic profile update email
 *   - "image-update" → image update email
 *   - "image-delete" → image deletion email
 */
export async function triggerHugoRebuild(options: {
  slug: string;
  action: string;
  notificationType?: ProfileNotificationType;
}): Promise<void> {
  const { slug, action, notificationType } = options;

  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping Hugo rebuild trigger", {
      slug,
      action,
    });
    return;
  }

  try {
    const octokit = await getOctokit();

    await octokit.rest.repos.createDispatchEvent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      event_type: "profile-update",
      client_payload: {
        slug,
        action,
        ...(notificationType && { notificationType }),
      },
    });

    logger.info("Triggered Hugo rebuild via repository_dispatch", {
      slug,
      action,
    });
  } catch (error) {
    logger.error("Failed to trigger Hugo rebuild", {
      errorId: ERROR_IDS.API_HUGO_REBUILD_FAILED,
      slug,
      action,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to trigger site rebuild", 500);
  }
}
