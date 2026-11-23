import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canViewReferral } from "../access/can-view-referral.js";
import { REFERRAL_PORTAL_DENIAL } from "../access/referral-portal-denial.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import { type ReferralDetail } from "../schemas/referral-schemas.js";
import { toReferralDetail } from "../schemas/to-referral-detail.js";
import type { MemberService } from "../services/member/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

/**
 * 404 body for a Referral outside the requester's window.
 * `code` lets the members app show "This referral is no longer open".
 */
const REFERRAL_NOT_OPEN = {
  error: "This referral is no longer open",
  code: "REFERRAL_NOT_OPEN",
};

export async function getReferralLogic({
  memberId,
  requestId,
  memberService,
  referralsService,
  referralPortalSettingsService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  requestId: string;
  memberService: MemberService;
  referralsService: ReferralsService;
  referralPortalSettingsService: ReferralPortalSettingsService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<ReferralDetail | { error: string; code?: string }> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );
    const access = await resolveReferralPortalAccess({
      decodedToken,
      loadMember: () => memberService.findById(memberId),
      referralPortalSettingsService,
      logger,
    });

    if (access !== "allowed") {
      set.status = 403;
      return REFERRAL_PORTAL_DENIAL[access];
    }

    const { id, document } = await referralsService.getReferral(
      requestId,
      logger,
    );

    if (!canViewReferral({ decodedToken, document })) {
      set.status = 404;
      return REFERRAL_NOT_OPEN;
    }

    return toReferralDetail(id, document);
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to get referral", {
      errorId: ERROR_IDS.API_MEMBER_GET_REFERRAL_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
      requestId,
    });

    set.status = 500;
    return { error: "Failed to retrieve referral" };
  }
}
