import { ERROR_IDS } from "../../constants/error-ids.js";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { ReadProfileResponse } from "../services/github/interface.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * Route logic for reading the current user's profile.
 * GET /api/profiles/me
 */
export async function readProfileLogic({
  uid,
  profileGitHubService,
  profileMemberService,
  logger,
  set,
}: {
  uid: string;
  profileGitHubService: ProfileGitHubService;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ReadProfileResponse | { error: string }> {
  try {
    // Verify user has active membership
    const member = await profileMemberService.verifyActiveMembership(uid);

    // Check if user has a profile (indicated by presence of slug)
    const slug = member.slug;
    if (!slug) {
      throw new ForbiddenError("User does not have a profile yet.");
    }

    // Read profile from GitHub (returns structured ProfileData)
    const profileData = await profileGitHubService.readProfile({ slug });

    logger.info("Successfully read profile", { uid, slug });

    return profileData;
  } catch (error) {
    return handleRouteError({
      error,
      operation: "read profile",
      errorId: ERROR_IDS.API_PROFILE_READ_FAILED,
      logger,
      set,
      context: { uid },
    });
  }
}
