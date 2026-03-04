import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import {
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
} from "../../../shared-api/errors/http-error.js";
import { MemberFirestoreService } from "../../../shared-api/services/member-firestore/index.js";
import type {
  ProfileMemberService as ProfileMemberServiceInterface,
  SetSlugResponse,
  SlugAvailabilityResponse,
} from "./interface.js";

/**
 * Get a member document by user ID.
 */
async function getMemberByUid(uid: string): Promise<MemberDocument> {
  try {
    const memberDocument = await MemberFirestoreService.getMemberByUid(uid);

    if (!memberDocument.exists) {
      throw new NotFoundError("No member document found for this user.");
    }

    const data = memberDocument.data() as MemberDocument | undefined;
    if (!data) {
      throw new NotFoundError("Member document data is empty.");
    }

    return data;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    logger.error("Failed to get member by UID", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      uid,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to retrieve member information", 500);
  }
}

/**
 * Verify user has an active membership and return the member document.
 */
async function verifyActiveMembership(uid: string): Promise<MemberDocument> {
  const member = await getMemberByUid(uid);

  if (!member.membershipActive) {
    throw new ForbiddenError("User does not have an active membership.");
  }

  return member;
}

/**
 * Check if a slug is available (not already in use).
 */
async function checkSlugAvailable(
  slug: string,
  excludeUid?: string,
): Promise<SlugAvailabilityResponse> {
  try {
    const database = getFirestore();
    const query = database
      .collection(MEMBERS_COLLECTION)
      .where("slug", "==", slug);

    const snapshot = await query.get();

    // If excludeUid provided, filter out that user's document
    if (excludeUid !== undefined && !snapshot.empty) {
      const otherUsersWithSlug = snapshot.docs.filter(
        document => document.id !== excludeUid,
      );
      return { available: otherUsersWithSlug.length === 0 };
    }

    return { available: snapshot.empty };
  } catch (error) {
    logger.error("Failed to check slug availability", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to check slug availability", 500);
  }
}

/**
 * Set the profile slug for a user.
 */
async function setSlug(options: {
  uid: string;
  slug: string;
}): Promise<SetSlugResponse> {
  const { uid, slug } = options;

  // Check if slug is available (excluding current user)
  const { available } = await checkSlugAvailable(slug, uid);
  if (!available) {
    throw new ConflictError(
      "This slug is already taken. Please choose another.",
    );
  }

  try {
    await MemberFirestoreService.updateMember(uid, { slug });

    logger.info("Set profile slug for user", { uid, slug });
    return { slug };
  } catch (error) {
    logger.error("Failed to set profile slug", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      uid,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to set profile slug", 500);
  }
}

/**
 * Mark profile as created by setting profileCreatedAt timestamp.
 */
async function setProfileCreatedAt(uid: string): Promise<void> {
  try {
    await MemberFirestoreService.updateMember(uid, {
      profileCreatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Set profileCreatedAt timestamp for user", { uid });
  } catch (error) {
    logger.error("Failed to update profileCreatedAt timestamp", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      uid,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Get a member document by slug.
 */
async function getMemberBySlug(
  slug: string,
): Promise<MemberDocument | undefined> {
  try {
    const database = getFirestore();
    const query = database
      .collection(MEMBERS_COLLECTION)
      .where("slug", "==", slug)
      .limit(1);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return undefined;
    }

    const document = snapshot.docs[0];
    if (!document) {
      return undefined;
    }

    return document.data() as MemberDocument;
  } catch (error) {
    logger.error("Failed to get member by slug", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to retrieve member information", 500);
  }
}

/**
 * Member service for profile-related operations.
 */
export const ProfileMemberService: ProfileMemberServiceInterface = {
  getMemberByUid,
  verifyActiveMembership,
  checkSlugAvailable,
  setSlug,
  setProfileCreatedAt,
  getMemberBySlug,
};

export type { SetSlugResponse, SlugAvailabilityResponse } from "./interface.js";
