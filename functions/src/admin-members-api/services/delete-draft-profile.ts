import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { MEMBERS_COLLECTION, PROFILES_COLLECTION, type ProfileDocument } from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { deleteProfileImage } from "../../profiles-api/services/imagekit/delete-profile-image.js";
import { triggerHugoRebuild } from "../../profiles-api/services/profile-store/trigger-rebuild.js";
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import { sendAdminFailureNotification } from "../../shared-api/utils/send-admin-failure-notification.js";
import { verifyMemberExists } from "./verify-member-exists.js";

export interface DeleteDraftProfileResult {
  slug: string;
  profileDeleted: boolean;
  profileImageDeleted: boolean;
  memberUpdated: boolean;
  hugoRebuildTriggered: boolean;
}

/**
 * Delete a member's draft profile while keeping the member account intact.
 * Removes the Firestore profile document, clears the member's profile link,
 * optionally deletes the ImageKit profile image, and triggers a Hugo rebuild.
 *
 * @param options.memberId - The Firestore document ID of the member
 * @param options.emailService - Optional email service for admin failure notifications
 * @returns Status of each deletion/update step
 * @throws NotFoundError if member or profile does not exist
 * @throws ValidationError if member has no slug or profile is not draft
 */
export async function deleteDraftProfile(options: {
  memberId: string;
  emailService?: EmailServiceInterface;
}): Promise<DeleteDraftProfileResult> {
  const { memberId, emailService } = options;

  try {
    const member = await verifyMemberExists(memberId);

    if (!member.slug) {
      throw new ValidationError(
        "Member does not have a profile slug. Cannot delete draft profile.",
      );
    }

    const { slug } = member;
    const firestore = getFirestore();
    const profileReference = firestore.collection(PROFILES_COLLECTION).doc(slug);
    const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(memberId);

    const profileDocument = await profileReference.get();

    if (!profileDocument.exists) {
      throw new NotFoundError(`Profile not found for slug: ${slug}`);
    }

    const profileData = profileDocument.data() as ProfileDocument;

    if (profileData.draft !== true) {
      throw new ValidationError(
        `Profile for slug "${slug}" is published and cannot be deleted with this action.`,
      );
    }

    const failures: string[] = [];
    let profileImageDeleted = false;
    let hugoRebuildTriggered = false;

    try {
      const imageDeleteResult = await deleteProfileImage({ slug });
      profileImageDeleted = imageDeleteResult.deleted;
    } catch (error) {
      failures.push("ImageKit profile image deletion failed");
      logger.error("Failed to delete draft profile image", {
        errorId: ERROR_IDS.API_ADMIN_DELETE_DRAFT_PROFILE_IMAGE_FAILED,
        memberId,
        slug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const batch = firestore.batch();
    batch.delete(profileReference);
    batch.update(memberReference, {
      slug: FieldValue.delete(),
      profileCreatedAt: FieldValue.delete(),
      profileApprovedAt: FieldValue.delete(),
    });
    await batch.commit();

    try {
      await triggerHugoRebuild({ slug, action: "draft" });
      hugoRebuildTriggered = true;
    } catch (error) {
      failures.push("Hugo rebuild trigger failed");
      logger.warn("Hugo rebuild trigger failed after draft profile deletion", {
        errorId: ERROR_IDS.API_HUGO_REBUILD_FAILED,
        memberId,
        slug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (failures.length > 0 && emailService) {
      await sendAdminFailureNotification({
        subject: `Draft profile deletion partial failure for ${member.email}`,
        title: "Draft profile deletion completed with failures",
        description:
          "A draft profile was deleted, but one or more follow-up actions failed and require manual attention.",
        email: member.email,
        memberId,
        failures,
        errorId: ERROR_IDS.API_ADMIN_DELETE_DRAFT_PROFILE_NOTIFICATION_FAILED,
        emailService,
        logger,
      });
    }

    logger.info("Deleted draft profile", {
      memberId,
      slug,
      profileDeleted: true,
      memberUpdated: true,
      profileImageDeleted,
      hugoRebuildTriggered,
    });

    return {
      slug,
      profileDeleted: true,
      profileImageDeleted,
      memberUpdated: true,
      hugoRebuildTriggered,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to delete draft profile", {
      errorId: ERROR_IDS.API_ADMIN_DELETE_DRAFT_PROFILE_FAILED,
      memberId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to delete draft profile", 500);
  }
}
