import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { buildProfileImageUrl } from "../../constants/imagekit.js";
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { verifyMemberExists } from "./verify-member-exists.js";

export interface ReadProfileResult {
  slug: string;
  profile: ProfileDocument;
}

/**
 * Read a member's profile directly from Firestore.
 * Bypasses the public endpoint's draft access control so admins can always view profiles.
 *
 * @param options.memberId - The Firestore document ID of the member
 * @returns The slug and profile data
 * @throws NotFoundError if member or profile does not exist
 * @throws ValidationError if member has no profile
 */
export async function readProfile(options: {
  memberId: string;
}): Promise<ReadProfileResult> {
  const { memberId } = options;

  // 1. Verify member exists and has a completed profile
  const member = await verifyMemberExists(memberId);

  // A slug can be reserved before a profile is created, so profileCreatedAt
  // (not slug) is the signal that a profile actually exists.
  if (!member.profileCreatedAt || !member.slug) {
    throw new ValidationError(
      "Member does not have a profile. Cannot read profile.",
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

    const profile = profileDocument.data() as ProfileDocument;
    profile.image = buildProfileImageUrl(slug);

    logger.info("Read member profile", { memberId, slug });

    return { slug, profile };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to read member profile", {
      errorId: ERROR_IDS.API_ADMIN_READ_PROFILE_FAILED,
      memberId,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to read member profile", 500);
  }
}
