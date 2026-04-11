import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { triggerHugoRebuild } from "../../profiles-api/services/profile-store/trigger-rebuild.js";
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { verifyMemberExists } from "./verify-member-exists.js";

export interface ToggleProfileDraftResult {
  slug: string;
  draft: boolean;
  hugoRebuildTriggered: boolean;
}

/**
 * Toggle the draft status of a member's profile.
 * Reads the current profile, flips `draft`, writes it back, and triggers a Hugo rebuild.
 *
 * @param options.memberId - The Firestore document ID of the member
 * @returns The slug, new draft status, and whether Hugo rebuild was triggered
 * @throws NotFoundError if member or profile does not exist
 * @throws ValidationError if member has no slug
 */
export async function toggleProfileDraft(options: {
  memberId: string;
}): Promise<ToggleProfileDraftResult> {
  const { memberId } = options;

  // 1. Verify member exists and get their slug
  const member = await verifyMemberExists(memberId);

  if (!member.slug) {
    throw new ValidationError(
      "Member does not have a profile slug. Cannot toggle draft status.",
    );
  }

  const { slug } = member;

  try {
    const firestore = getFirestore();
    const profileReference = firestore
      .collection(PROFILES_COLLECTION)
      .doc(slug);
    const profileDocument = await profileReference.get();

    if (!profileDocument.exists) {
      throw new NotFoundError(`Profile not found for slug: ${slug}`);
    }

    const profileData = profileDocument.data() as ProfileDocument;
    const currentDraft = profileData.draft ?? false;
    const newDraft = !currentDraft;

    // 2. Update draft status
    await profileReference.update({
      draft: newDraft,
      updatedAt: new Date().toISOString(),
    });

    // 3. Trigger Hugo rebuild
    let hugoRebuildTriggered = false;
    try {
      await triggerHugoRebuild({
        slug,
        action: newDraft ? "draft" : "publish",
        ...(!newDraft && { notificationType: "publish" }),
      });
      hugoRebuildTriggered = true;
    } catch (error) {
      // Non-critical: log but don't fail the toggle
      logger.warn("Hugo rebuild trigger failed after draft toggle", {
        errorId: ERROR_IDS.API_HUGO_REBUILD_FAILED,
        slug,
        newDraft,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    logger.info("Toggled profile draft status", {
      slug,
      previousDraft: currentDraft,
      newDraft,
      hugoRebuildTriggered,
    });

    return { slug, draft: newDraft, hugoRebuildTriggered };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to toggle profile draft status", {
      errorId: ERROR_IDS.API_ADMIN_TOGGLE_DRAFT_FAILED,
      memberId,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to toggle profile draft status", 500);
  }
}
