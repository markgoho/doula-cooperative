import { ERROR_IDS } from "../../constants/error-ids.js";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * Response type for write profile route.
 */
export interface WriteProfileResponse {
  success: true;
}

/**
 * Route logic for updating the current user's profile.
 * PUT /api/profiles/me
 */
export async function writeProfileLogic({
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
}): Promise<WriteProfileResponse | { error: string }> {
  try {
    // Verify user has active membership
    const member = await profileMemberService.verifyActiveMembership(uid);

    // Check if user has a profile (indicated by presence of slug)
    const slug = member.slug;
    if (!slug) {
      throw new ForbiddenError(
        "Profile not found. User may need to claim their existing membership first.",
      );
    }

    // Write profile to GitHub
    // Note: existingSha is empty to let the service fetch current SHA
    await profileGitHubService.writeProfile({ slug, data, existingSha: "" });

    logger.info("Successfully updated profile", { uid, slug });

    return { success: true };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "update profile",
      errorId: ERROR_IDS.API_PROFILE_WRITE_FAILED,
      logger,
      set,
      context: { uid },
    });
  }
}
