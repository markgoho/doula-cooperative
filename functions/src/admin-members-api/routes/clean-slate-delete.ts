import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import type { CleanSlateApiResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for POST /:memberId/clean-slate.
 * Performs a full clean slate delete across all integrated systems.
 */
export async function cleanSlateDeleteLogic({
  memberId,
  adminUid,
  memberAdminService,
  emailService,
  logger,
  set,
}: {
  memberId: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  emailService?: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<CleanSlateApiResponse> {
  try {
    const result = await memberAdminService.cleanSlateDelete({
      memberId,
      requestingAdminUid: adminUid,
      ...(emailService !== undefined && { emailService }),
    });

    logger.info("Admin performed clean slate delete", {
      adminUid,
      deletedUid: memberId,
      subscriptionCanceled: result.subscriptionCanceled,
      stripeCustomerDeleted: result.stripeCustomerDeleted,
      newsletterUnsubscribed: result.newsletterUnsubscribed,
      profileDeleted: result.profileDeleted,
      profileImageDeleted: result.profileImageDeleted,
    });

    return {
      success: true,
      deletedUid: result.deletedUid,
      ...(result.subscriptionCanceled !== undefined && {
        subscriptionCanceled: result.subscriptionCanceled,
      }),
      ...(result.stripeCustomerDeleted !== undefined && {
        stripeCustomerDeleted: result.stripeCustomerDeleted,
      }),
      ...(result.newsletterUnsubscribed !== undefined && {
        newsletterUnsubscribed: result.newsletterUnsubscribed,
      }),
      ...(result.profileDeleted !== undefined && {
        profileDeleted: result.profileDeleted,
      }),
      ...(result.profileImageDeleted !== undefined && {
        profileImageDeleted: result.profileImageDeleted,
      }),
      memberDocumentDeleted: result.memberDocumentDeleted,
      authUserDeleted: result.authUserDeleted,
      ...(result.warning !== undefined && { warning: result.warning }),
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "clean slate delete",
      errorId: ERROR_IDS.API_ADMIN_CLEAN_SLATE_FAILED,
      logger,
      set,
      context: { memberId, adminUid },
    });
  }
}
