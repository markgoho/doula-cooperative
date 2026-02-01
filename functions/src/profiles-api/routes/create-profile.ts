import { ERROR_IDS } from "../../constants/error-ids.js";
import type { CreateProfileResponse } from "../schemas/profile-schemas.js";
import { createProfileRouteHandler } from "./profile-route-handler-factory.js";

export const createProfileLogic =
  createProfileRouteHandler<CreateProfileResponse>({
    operation: "created profile",
    errorId: ERROR_IDS.API_PROFILE_CREATE_FAILED,
    slugNotFoundMessage:
      "Profile slug not found. User must create a slug first.",
    successStatus: 201,
    gitHubOperation: (service, slug, data) =>
      service.createProfile({ slug, data }),
    afterGitHubOperation: (memberService, uid) =>
      memberService.setProfileCreatedAt(uid),
    buildSuccessResponse: () => ({ success: true }),
  });
