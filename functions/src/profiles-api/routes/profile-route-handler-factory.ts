import { ERROR_IDS, type ErrorId } from "../../constants/error-ids.js";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import type { ProfileStoreService } from "../services/profile-store/interface.js";
import type { ProfileNotificationType } from "../../profile-webhook-api/services/types.js";

function getNotificationType(
  buildNotificationType: (() => ProfileNotificationType) | undefined,
): ProfileNotificationType | undefined {
  return buildNotificationType?.();
}

/**
 * Configuration for profile route handler factory.
 */
export interface ProfileRouteHandlerConfig<TResponse> {
  operation: string;
  errorId: ErrorId;
  slugNotFoundMessage: string;
  successStatus?: number;
  /** Build the notification type for the deployment webhook notification email.
   *  When provided, the webhook sends a member notification after deploy.
   *  Example: () => "update" */
  buildNotificationType?: () => ProfileNotificationType;
  storeOperation: (
    service: ProfileStoreService,
    slug: string,
    data: ProfileData,
  ) => Promise<unknown>;
  afterStoreOperation?: (
    profileMemberService: ProfileMemberService,
    uid: string,
  ) => Promise<unknown>;
  buildSuccessResponse: (data: ProfileData) => TResponse;
}

/**
 * Generic route handler factory for profile write operations.
 * Used by writeProfileLogic to reduce boilerplate for the standard
 * membership-verify / slug-check / Firestore-op / trigger-rebuild flow.
 *
 * Common flow:
 * 1. Verify active membership
 * 2. Check for slug presence
 * 3. Execute Firestore operation
 * 4. Trigger Hugo rebuild (non-critical)
 * 5. Execute post-store operation (optional)
 * 6. Log success
 * 7. Handle errors
 */
export function createProfileRouteHandler<TResponse>(
  config: ProfileRouteHandlerConfig<TResponse>,
) {
  return async ({
    uid,
    data,
    profileStoreService,
    profileMemberService,
    logger,
    set,
  }: {
    uid: string;
    data: ProfileData;
    profileStoreService: ProfileStoreService;
    profileMemberService: ProfileMemberService;
    logger: Logger;
    set: { status?: number | string };
  }): Promise<TResponse> => {
    try {
      const member = await profileMemberService.verifyProfileEditingAllowed(uid);

      const slug = member.slug;
      if (!slug) {
        throw new ForbiddenError(config.slugNotFoundMessage);
      }

      await config.storeOperation(profileStoreService, slug, data);

      // Trigger Hugo rebuild only for published profiles (non-critical)
      try {
        const profile = await profileStoreService.readProfile({ slug });
        if (profile.draft) {
          logger.info("Skipping Hugo rebuild for draft profile", {
            slug,
            action: config.operation,
          });
        } else {
          const { triggerHugoRebuild } =
            await import("../services/profile-store/trigger-rebuild.js");
          const notificationType = getNotificationType(
            config.buildNotificationType,
          );
          await triggerHugoRebuild({
            slug,
            action: config.operation,
            ...(notificationType && { notificationType }),
          });
        }
      } catch (error: unknown) {
        logger.error("Failed to trigger Hugo rebuild after write", {
          errorId: ERROR_IDS.API_HUGO_REBUILD_FAILED,
          uid,
          slug,
          error,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        });
      }

      if (config.afterStoreOperation) {
        await config.afterStoreOperation(profileMemberService, uid);
      }

      logger.info(`Successfully ${config.operation}`, { uid, slug });

      if (config.successStatus) {
        set.status = config.successStatus;
      }

      return config.buildSuccessResponse(data);
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
