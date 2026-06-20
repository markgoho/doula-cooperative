import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION } from "../../collections/migrated-users-import.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { draftProfile } from "../../profiles-api/services/profile-store/draft-profile.js";
import { triggerHugoRebuild } from "../../profiles-api/services/profile-store/trigger-rebuild.js";
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { DraftUnclaimedProfileSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";

export async function draftUnclaimedProfile(options: {
  email: string;
  logger: Logger;
}): Promise<DraftUnclaimedProfileSuccessResponse> {
  const { email, logger } = options;

  try {
    const firestore = getFirestore();
    const documentReference = firestore
      .collection(IMPORT_COLLECTION)
      .doc(email);
    const document = await documentReference.get();

    if (!document.exists) {
      logger.warn("Unclaimed profile not found", {
        errorId: ERROR_IDS.API_UNCLAIMED_PROFILE_NOT_FOUND,
        email,
      });
      throw new NotFoundError(
        `Unclaimed profile with email ${email} not found`,
      );
    }

    const documentData = document.data();
    const slug =
      documentData !== undefined && typeof documentData["slug"] === "string"
        ? documentData["slug"]
        : undefined;

    if (slug === undefined || slug.length === 0) {
      logger.warn("Unclaimed profile is missing slug", {
        email,
      });
      throw new ValidationError(
        `Unclaimed profile with email ${email} does not have a profile slug`,
      );
    }

    await draftProfile({ slug });
    logger.info("Set unclaimed profile to draft", { email, slug });

    let wasRebuildTriggered = true;

    try {
      await triggerHugoRebuild({
        slug,
        action: "unclaimed profile drafted",
      });
    } catch (rebuildError) {
      wasRebuildTriggered = false;
      logger.error(
        "Failed to trigger Hugo rebuild after drafting unclaimed profile",
        {
          errorId: ERROR_IDS.API_HUGO_REBUILD_FAILED,
          email,
          slug,
          error: rebuildError,
          errorMessage:
            rebuildError instanceof Error
              ? rebuildError.message
              : "Unknown error",
        },
      );
    }

    return {
      success: true,
      slug,
      ...(!wasRebuildTriggered && {
        warning:
          "Profile was set to draft, but the site rebuild did not trigger. The change may not appear immediately.",
      }),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to draft unclaimed profile", {
      errorId: ERROR_IDS.API_ADMIN_DRAFT_UNCLAIMED_PROFILE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      email,
    });
    throw error;
  }
}
