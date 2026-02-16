import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type {
  ProfileGitHubService,
  ReadProfileResponse,
} from "../services/github/interface.js";

export async function readProfileBySlugLogic({
  slug,
  profileGitHubService,
  logger,
  set,
}: {
  slug: string;
  profileGitHubService: ProfileGitHubService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ReadProfileResponse | { error: string }> {
  try {
    const profileData = await profileGitHubService.readProfile({
      slug,
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
