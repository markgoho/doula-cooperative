import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  IMPORT_COLLECTION,
  MEMBERS_COLLECTION,
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { moveProfileImage } from "../../profiles-api/services/imagekit/move-profile-image.js";
import { triggerHugoRebuild } from "../../profiles-api/services/profile-store/trigger-rebuild.js";
import {
  ConflictError,
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";

export interface ChangeSlugResult {
  member: MemberDocument;
  oldSlug: string;
  newSlug: string;
  imageMoveWarning?: string;
}

/**
 * Change a member's profile slug.
 *
 * Firestore profile documents are keyed by slug, so a rename is: create a new
 * profile document at the new slug with the old document's data, delete the
 * old document, and update the member's `slug` field. Done inside a
 * transaction so a concurrent change can't race the collision check.
 *
 * Non-critical follow-up steps (ImageKit image move, Hugo rebuild, import
 * record cleanup) run after the transaction commits and never fail the
 * response — image-move failures surface as `imageMoveWarning`.
 *
 * @param options.memberId - The Firestore document ID of the member
 * @param options.newSlug - The new profile slug
 * @returns The updated member, the old/new slugs, and an optional image-move warning
 * @throws NotFoundError if the member or its profile does not exist
 * @throws ConflictError if the member has no slug, the new slug matches the old slug, or the new slug is already taken
 */
export async function changeSlug(options: {
  memberId: string;
  newSlug: string;
}): Promise<ChangeSlugResult> {
  const { memberId, newSlug } = options;
  const firestore = getFirestore();
  const memberReference = firestore
    .collection(MEMBERS_COLLECTION)
    .doc(memberId);
  const newProfileReference = firestore
    .collection(PROFILES_COLLECTION)
    .doc(newSlug);

  try {
    const oldSlug = await firestore.runTransaction(async transaction => {
      const memberSnapshot = await transaction.get(memberReference);

      if (!memberSnapshot.exists) {
        throw new NotFoundError(`Member with ID ${memberId} not found`);
      }

      const memberData = memberSnapshot.data() as MemberDocument;
      const currentSlug = memberData.slug;

      if (currentSlug === undefined) {
        throw new ConflictError(
          "Member does not have a profile slug to change.",
        );
      }

      if (newSlug === currentSlug) {
        throw new ConflictError(
          "New slug must be different from the current slug.",
        );
      }

      const oldProfileReference = firestore
        .collection(PROFILES_COLLECTION)
        .doc(currentSlug);

      const [oldProfileSnapshot, newProfileSnapshot] = await Promise.all([
        transaction.get(oldProfileReference),
        transaction.get(newProfileReference),
      ]);

      if (!oldProfileSnapshot.exists) {
        throw new NotFoundError(`Profile not found for slug: ${currentSlug}`);
      }

      if (newProfileSnapshot.exists) {
        throw new ConflictError(`Slug "${newSlug}" is already taken.`);
      }

      const oldProfileData = oldProfileSnapshot.data() as ProfileDocument;

      transaction.create(newProfileReference, {
        ...oldProfileData,
        updatedAt: new Date().toISOString(),
      });
      transaction.delete(oldProfileReference);
      transaction.update(memberReference, { slug: newSlug });

      return currentSlug;
    });

    let imageMoveWarning: string | undefined;

    try {
      await moveProfileImage({ oldSlug, newSlug });
    } catch (error) {
      imageMoveWarning =
        "Profile image could not be moved to the new slug and may need manual attention.";
      logger.error("Failed to move profile image after slug change", {
        errorId: ERROR_IDS.ADMIN_CHANGE_SLUG_IMAGE_MOVE_FAILED,
        memberId,
        oldSlug,
        newSlug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    try {
      await triggerHugoRebuild({ slug: newSlug, action: "change slug" });
    } catch (error) {
      logger.warn("Hugo rebuild trigger failed after slug change", {
        errorId: ERROR_IDS.API_HUGO_REBUILD_FAILED,
        memberId,
        oldSlug,
        newSlug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    try {
      const importCollection = firestore.collection(IMPORT_COLLECTION);
      const importSlugSnapshot = await importCollection
        .where("slug", "==", oldSlug)
        .limit(1)
        .get();

      const importDocument = importSlugSnapshot.docs[0];

      if (importDocument !== undefined) {
        await importDocument.ref.update({ slug: newSlug });
        logger.info("Updated import record slug after admin change-slug", {
          memberId,
          oldSlug,
          newSlug,
        });
      }
    } catch (error) {
      logger.error("Failed to update import record after admin change-slug", {
        errorId: ERROR_IDS.API_ADMIN_CHANGE_SLUG_IMPORT_UPDATE_FAILED,
        memberId,
        oldSlug,
        newSlug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const updatedMemberDocument = await memberReference.get();

    if (!updatedMemberDocument.exists) {
      throw new NotFoundError(`Member not found for ID: ${memberId}`);
    }

    const updatedMember: MemberDocument = {
      ...(updatedMemberDocument.data() as MemberDocument),
      uid: updatedMemberDocument.id,
    };

    logger.info("Changed member profile slug", { memberId, oldSlug, newSlug });

    return {
      member: updatedMember,
      oldSlug,
      newSlug,
      ...(imageMoveWarning !== undefined && { imageMoveWarning }),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to change member profile slug", {
      errorId: ERROR_IDS.API_ADMIN_CHANGE_SLUG_FAILED,
      memberId,
      newSlug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to change member profile slug", 500);
  }
}
