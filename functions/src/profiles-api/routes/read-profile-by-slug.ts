import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type {
  ProfileGitHubService,
  ReadProfileResponse,
} from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * Route logic for reading a profile by slug (public endpoint).
 * GET /api/profiles/by-slug/:slug
 *
 * No authentication required - profile content is public.
 */
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
    const profileData = await profileGitHubService.readProfile({
      slug,
      profileMemberService,
    });

    logger.info("Successfully read profile by slug", { slug });

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
