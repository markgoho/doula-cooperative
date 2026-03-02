import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type {
  ProfileStoreService,
  ReadProfileResponse,
} from "../services/profile-store/interface.js";

export async function readProfileBySlugLogic({
  slug,
  profileStoreService,
  logger,
  set,
}: {
  slug: string;
  profileStoreService: ProfileStoreService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ReadProfileResponse | { error: string }> {
  try {
    const profileData = await profileStoreService.readProfile({ slug });

    logger.info("Read profile from Firestore", { slug });

    return profileData;
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
