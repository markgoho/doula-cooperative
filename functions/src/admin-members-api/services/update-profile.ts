import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { buildProfileImageUrl } from "../../constants/imagekit.js";
import type { ProfileData } from "../../profiles-api/schemas/profile-schemas.js";
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { verifyMemberExists } from "./verify-member-exists.js";

const NOT_FOUND_CODE = 5;

export interface UpdateProfileResult {
  slug: string;
  profile: ProfileDocument;
}

export async function updateProfile(options: {
  memberId: string;
  data: ProfileData;
}): Promise<UpdateProfileResult> {
  const { memberId, data } = options;

  const member = await verifyMemberExists(memberId);

  if (!member.slug) {
    throw new ValidationError(
      "Member does not have a profile slug. Cannot update profile.",
    );
  }

  const { slug } = member;

  try {
    const firestore = getFirestore();
    const profileReference = firestore
      .collection(PROFILES_COLLECTION)
      .doc(slug);

    const updates: Partial<ProfileDocument> = {
      title: data.title,
      bio: data.bio,
      updatedAt: new Date().toISOString(),
    };

    if (data.credentials !== undefined) {
      updates.credentials = data.credentials;
    }
    if (data.pronouns !== undefined) {
      updates.pronouns = data.pronouns;
    }
    if (data.tags !== undefined) {
      updates.tags = data.tags;
    }
    if (data.contact !== undefined) {
      updates.contact = data.contact;
    }

    await profileReference.update(updates);

    const profileDocument = await profileReference.get();
    if (!profileDocument.exists) {
      throw new NotFoundError(`Profile not found for slug: ${slug}`);
    }

    const profile = profileDocument.data() as ProfileDocument;
    profile.image = buildProfileImageUrl(slug);

    logger.info("Updated member profile", { memberId, slug });

    return { slug, profile };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (isFirestoreNotFoundError(error)) {
      throw new NotFoundError(`Profile not found for slug: ${slug}`);
    }

    logger.error("Failed to update member profile", {
      errorId: ERROR_IDS.API_ADMIN_UPDATE_PROFILE_FAILED,
      memberId,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to update member profile", 500);
  }
}

function isFirestoreNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === NOT_FOUND_CODE
  );
}
