import type { ErrorId } from "../../constants/error-ids.js";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * Configuration for profile route handler factory.
 */
export interface ProfileRouteHandlerConfig<TResponse> {
  operation: string;
  errorId: ErrorId;
  slugNotFoundMessage: string;
  successStatus?: number;
  gitHubOperation: (
    service: ProfileGitHubService,
    slug: string,
    data: ProfileData,
  ) => Promise<unknown>;
  afterGitHubOperation?: (
    profileMemberService: ProfileMemberService,
    uid: string,
  ) => Promise<unknown>;
  buildSuccessResponse: () => TResponse;
}

/**
 * Generic route handler factory for profile operations.
 * Reduces duplication between create and write profile routes.
 *
 * Common flow:
 * 1. Verify active membership
 * 2. Check for slug presence
 * 3. Execute GitHub operation
 * 4. Execute post-GitHub operation (optional)
 * 5. Log success
 * 6. Handle errors
 */
export function createProfileRouteHandler<TResponse>(
  config: ProfileRouteHandlerConfig<TResponse>,
) {
  return async ({
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
  }): Promise<TResponse> => {
    try {
      const member = await profileMemberService.verifyActiveMembership(uid);

      const slug = member.slug;
      if (!slug) {
        throw new ForbiddenError(config.slugNotFoundMessage);
      }

      await config.gitHubOperation(profileGitHubService, slug, data);

      if (config.afterGitHubOperation) {
        await config.afterGitHubOperation(profileMemberService, uid);
      }

      logger.info(`Successfully ${config.operation}`, { uid, slug });

      if (config.successStatus) {
        set.status = config.successStatus;
      }

      return config.buildSuccessResponse();
    } catch (error) {
      const errorResponse = handleRouteError({
        error,
        operation: config.operation,
        errorId: config.errorId,
        logger,
        set,
        context: { uid },
      });
      return errorResponse as TResponse;
    }
  };
}
