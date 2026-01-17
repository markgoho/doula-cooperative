import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type {
  ProfileMemberService,
  SlugAvailabilityResponse,
} from "../services/member/interface.js";

/**
 * Route logic for checking slug availability.
 * GET /api/profiles/slugs/check?slug=jane-doe
 */
export async function checkSlugAvailableLogic({
  slug,
  profileMemberService,
  logger,
  set,
}: {
  slug: string;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<SlugAvailabilityResponse | { error: string }> {
  try {
    logger.info("Checking slug availability", { slug });
    const result = await profileMemberService.checkSlugAvailable(slug);
    return result;
  } catch (error) {
    return handleRouteError({
      error,
      operation: "check slug availability",
      errorId: ERROR_IDS.API_PROFILE_SLUG_CHECK_FAILED,
      logger,
      set,
      context: { slug },
    });
  }
}
