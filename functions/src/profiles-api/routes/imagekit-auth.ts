import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ImageKitAuthSuccessResponse } from "../schemas/profile-schemas.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import { getImageKitClient } from "../utils/imagekit-client.js";

/**
 * Get ImageKit auth parameters for client-side uploads.
 * GET /api/profiles/auth
 *
 * Protected endpoint - requires active membership.
 * Returns signed authentication parameters that clients use for direct uploads to ImageKit.
 */
export async function imagekitAuthLogic({
  uid,
  profileMemberService,
  logger,
  set,
}: {
  uid: string;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ImageKitAuthSuccessResponse | { error: string }> {
  logger.info("ImageKit auth request initiated", { uid });

  try {
    // Verify user has active membership
    await profileMemberService.verifyActiveMembership(uid);

    // Get ImageKit client and generate auth parameters
    const imagekit = getImageKitClient();
    const authParameters = imagekit.getAuthenticationParameters();

    logger.info("ImageKit auth parameters generated", {
      uid,
      expire: authParameters.expire,
    });

    return authParameters;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get ImageKit auth parameters",
      errorId: ERROR_IDS.IMAGEKIT_AUTH_FAILED,
      logger,
      set,
      context: { uid },
    });
  }
}
