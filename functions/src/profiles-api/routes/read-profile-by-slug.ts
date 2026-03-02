import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import type {
  ProfileGitHubService,
  ReadProfileResponse,
} from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

export async function readProfileBySlugLogic({
  slug,
  profileGitHubService,
  profileMemberService,
  logger,
  set,
}: {
  slug: string;
  profileGitHubService: ProfileGitHubService;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ReadProfileResponse | { error: string }> {
  try {
    // Try reading from Firestore first (instant, consistent)
    const member = await profileMemberService.getMemberBySlug(slug);

    if (member?.profile) {
      logger.info("Read profile from Firestore cache", { slug });
      return member.profile;
    }

    // Fallback: read from GitHub and lazily backfill Firestore
    const profileData = await profileGitHubService.readProfile({ slug });

    logger.info("Read profile from GitHub (Firestore cache miss)", { slug });

    // Lazily write to Firestore for next time (non-critical)
    if (member?.uid) {
      lazyBackfillFirestore({
        uid: member.uid,
        data: profileData,
        slug,
        profileMemberService,
        logger,
      });
    }

    return profileData;
  } catch (error) {
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

/**
 * Backfill Firestore with profile data from GitHub.
 * Fire-and-forget — does not block the response.
 */
function lazyBackfillFirestore({
  uid,
  data,
  slug,
  profileMemberService,
  logger,
}: {
  uid: string;
  data: ProfileData;
  slug: string;
  profileMemberService: ProfileMemberService;
  logger: Logger;
}): void {
  profileMemberService.saveProfileContent(uid, data, slug).catch((error) => {
    logger.error("Failed to lazily backfill profile in Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      uid,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  });
}
