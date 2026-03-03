import type { DecodedIdToken } from "firebase-admin/auth";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ReadProfileSuccessResponse } from "../schemas/profile-schemas.js";
import type {
  ProfileStoreService,
  ReadProfileResponse,
} from "../services/profile-store/interface.js";

/**
 * Strips internal fields (ownerUid) from the profile response before sending to client.
 */
function toPublicProfile(
  profile: ReadProfileResponse,
): ReadProfileSuccessResponse {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ownerUid, ...publicProfile } = profile;
  return publicProfile;
}

/**
 * Check if the user can access a draft profile.
 * Admins and profile owners can view drafts; everyone else gets 404.
 */
function canAccessDraftProfile(
  userToken: DecodedIdToken | undefined,
  ownerUid: string | undefined,
): boolean {
  if (!userToken) {
    return false;
  }

  // Admin can access any draft
  if (userToken["admin"] === true) {
    return true;
  }

  // Profile owner can access their own draft
  if (ownerUid && userToken.uid === ownerUid) {
    return true;
  }

  return false;
}

export async function readProfileBySlugLogic({
  slug,
  profileStoreService,
  userToken,
  logger,
  set,
}: {
  slug: string;
  profileStoreService: ProfileStoreService;
  userToken: DecodedIdToken | undefined;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ReadProfileSuccessResponse | { error: string }> {
  try {
    const profileData = await profileStoreService.readProfile({ slug });

    // Draft profiles are only visible to admins and the profile owner
    if (profileData.draft) {
      if (!canAccessDraftProfile(userToken, profileData.ownerUid)) {
        logger.info("Draft profile access denied", {
          slug,
          hasAuth: Boolean(userToken),
        });
        set.status = 404;
        return { error: "Profile not found" };
      }
      logger.info("Draft profile access granted", {
        slug,
        uid: userToken?.uid,
        isAdmin: userToken?.["admin"] === true,
      });
    }

    logger.info("Read profile from Firestore", { slug });

    return toPublicProfile(profileData);
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "read profile by slug",
      errorId: ERROR_IDS.API_PROFILE_READ_FAILED,
      logger,
      set,
      context: { slug },
    });
  }
}
