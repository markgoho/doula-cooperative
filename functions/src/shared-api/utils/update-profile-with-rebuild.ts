import { logger as firebaseLogger } from "firebase-functions/v2";
import { triggerHugoRebuild } from "../../profiles-api/services/profile-store/trigger-rebuild.js";
import type { Logger } from "../types/logger.js";

/**
 * Execute a profile action (draft or delete) and trigger a Hugo rebuild.
 *
 * Handles the common pattern of:
 *   1. Run the profile action (draftProfile or deleteProfile)
 *   2. On success, trigger a Hugo rebuild (non-blocking — rebuild failure is logged but not propagated)
 *   3. On failure, log with the provided error ID and push to failures array
 *
 * @returns true if the profile action succeeded, false if it failed
 */
export async function didProfileActionSucceed({
  slug,
  action,
  actionLabel,
  profileAction,
  errorId,
  memberId,
  failures,
  logger = firebaseLogger,
}: {
  slug: string;
  action: string;
  actionLabel: string;
  profileAction: (options: { slug: string }) => Promise<unknown>;
  errorId: string;
  memberId: string;
  failures: string[];
  logger?: Logger;
}): Promise<boolean> {
  try {
    await profileAction({ slug });
    logger.info(`${actionLabel} after ${action}`, {
      memberId,
      slug,
    });

    // NON-CRITICAL: Trigger Hugo rebuild
    try {
      await triggerHugoRebuild({ slug, action });
    } catch (rebuildError: unknown) {
      const rebuildErrorMessage =
        rebuildError instanceof Error ? rebuildError.message : "Unknown error";
      logger.error(`Failed to trigger Hugo rebuild after ${action}`, {
        memberId,
        slug,
        error: rebuildError,
        errorMessage: rebuildErrorMessage,
      });
    }

    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to ${actionLabel.toLowerCase()} during ${action}`, {
      errorId,
      memberId,
      slug,
      error,
      errorMessage,
    });
    failures.push(`${actionLabel} (slug: ${slug}): ${errorMessage}`);
    return false;
  }
}
