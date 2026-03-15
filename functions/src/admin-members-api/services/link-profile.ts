import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  MEMBERS_COLLECTION,
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";
import { verifyMemberExists } from "./verify-member-exists.js";

export interface LinkProfileResult {
  member: MemberDocument;
}

/**
 * Link an unlinked profile to a member account.
 * Creates a bidirectional relationship:
 *   - profiles[slug].ownerUid = memberId
 *   - members[memberId].slug = slug
 *   - members[memberId].profileCreatedAt = profile.createdAt
 *
 * Uses a Firestore batch write for atomicity.
 *
 * @param options.memberId - The Firestore document ID of the member
 * @param options.slug - The profile slug to link
 * @returns The updated member document
 * @throws NotFoundError if member or profile does not exist
 * @throws ValidationError if member already has a profile or profile is already linked
 */
export async function linkProfile(options: {
  memberId: string;
  slug: string;
}): Promise<LinkProfileResult> {
  const { memberId, slug } = options;

  try {
    const member = await verifyMemberExists(memberId);

    // 2. Verify member doesn't already have a slug
    if (member.slug !== undefined) {
      throw new ValidationError(
        `Member already has a linked profile with slug: ${member.slug}`,
      );
    }

    const firestore = getFirestore();

    // 3. Read the profile document
    const profileReference = firestore
      .collection(PROFILES_COLLECTION)
      .doc(slug);
    const profileDocument = await profileReference.get();

    if (!profileDocument.exists) {
      throw new NotFoundError(`Profile not found for slug: ${slug}`);
    }

    const profileData = profileDocument.data() as ProfileDocument;

    // 4. Verify profile is not already linked
    if (profileData.ownerUid !== undefined) {
      throw new ValidationError(
        `Profile "${slug}" is already linked to member: ${profileData.ownerUid}`,
      );
    }

    // 5. Batch write: set both sides of the relationship atomically
    const batch = firestore.batch();

    const memberReference = firestore
      .collection(MEMBERS_COLLECTION)
      .doc(memberId);

    batch.update(profileReference, { ownerUid: memberId });
    const profileCreatedAt = Timestamp.fromDate(new Date(profileData.createdAt));

    batch.update(memberReference, {
      slug,
      profileCreatedAt,
    });

    await batch.commit();

    // 6. Read and return the updated member document
    const updatedMemberDocument = await memberReference.get();

    if (!updatedMemberDocument.exists) {
      throw new NotFoundError(`Member not found for ID: ${memberId}`);
    }

    const updatedMember = updatedMemberDocument.data() as MemberDocument;

    logger.info("Linked profile to member", { memberId, slug });

    return {
      member: {
        ...updatedMember,
        uid: updatedMemberDocument.id,
      },
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to link profile to member", {
      errorId: ERROR_IDS.API_ADMIN_LINK_PROFILE_FAILED,
      memberId,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to link profile to member", 500);
  }
}
