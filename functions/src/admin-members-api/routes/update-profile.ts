import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileData } from "../../profiles-api/schemas/profile-schemas.js";
import type { UpdateProfileApiResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

export async function updateProfileLogic({
  memberId,
  profileData,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  profileData: ProfileData;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<UpdateProfileApiResponse> {
  try {
    const result = await memberAdminService.updateProfile({
      memberId,
      data: profileData,
    });

    logger.info("Admin updated member profile", {
      adminUid,
      memberId,
      slug: result.slug,
    });

    return {
      success: true,
      slug: result.slug,
      profile: result.profile,
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "update profile",
      errorId: ERROR_IDS.API_ADMIN_UPDATE_PROFILE_FAILED,
      logger,
      set,
      context: { memberId, adminUid },
    });
  }
}
