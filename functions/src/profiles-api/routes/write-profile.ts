import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { WriteProfileResponse } from "../schemas/profile-schemas.js";
import { createProfileRouteHandler } from "./profile-route-handler-factory.js";

export const writeProfileLogic =
  createProfileRouteHandler<WriteProfileResponse>({
    operation: "updated profile",
    errorId: ERROR_IDS.API_PROFILE_WRITE_FAILED,
    slugNotFoundMessage:
      "Profile not found. User may need to claim their existing membership first.",
    buildNotificationType: () => "update",
    storeOperation: (service, slug, data) =>
      service.writeProfile({ slug, data }),
    buildSuccessResponse: data => ({ success: true, profile: data }),
  });
