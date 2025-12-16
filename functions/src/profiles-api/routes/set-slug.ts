import { ERROR_IDS } from "../../constants/error-ids.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  ProfileMemberService,
  SetSlugResponse,
} from "../services/member/interface.js";

/**
 * Route logic for setting the current user's profile slug.
 * POST /api/profiles/slugs
 */
export async function setSlugLogic({
  uid,
  slug,
  profileMemberService,
  logger,
  set,
}: {
  uid: string;
  slug: string;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<SetSlugResponse | { error: string }> {
  try {
    logger.info("Setting profile slug", { uid, slug });
    const result = await profileMemberService.setSlug({ uid, slug });
    return result;
  } catch (error) {
    return handleRouteError({
      error,
      operation: "set profile slug",
      errorId: ERROR_IDS.API_PROFILE_SLUG_SET_FAILED,
      logger,
      set,
      context: { uid, slug },
    });
  }
}
