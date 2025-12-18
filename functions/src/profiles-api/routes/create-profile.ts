import { ERROR_IDS } from "../../constants/error-ids.js";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  CreateProfileResponse,
  ProfileData,
} from "../schemas/profile-schemas.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * Route logic for creating the current user's profile.
 * POST /api/profiles/me
 */
export async function createProfileLogic({
  uid,
  data,
  profileGitHubService,
  profileMemberService,
  logger,
  set,
}: {
  uid: string;
  data: ProfileData;
  profileGitHubService: ProfileGitHubService;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<CreateProfileResponse> {
  try {
    // Verify user has active membership
    const member = await profileMemberService.verifyActiveMembership(uid);

    // Check if user has a slug (required for profile creation)
    const slug = member.slug;
    if (!slug) {
      throw new ForbiddenError(
        "Profile slug not found. User must create a slug first.",
      );
    }

    // Create profile on GitHub
    await profileGitHubService.createProfile({ slug, data });

    // Update member document with profile creation timestamp
    await profileMemberService.setProfileCreatedAt(uid);

    logger.info("Successfully created profile", { uid, slug });
    set.status = 201;

    return { success: true };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "create profile",
      errorId: ERROR_IDS.API_PROFILE_CREATE_FAILED,
      logger,
      set,
      context: { uid },
    });
  }
}
