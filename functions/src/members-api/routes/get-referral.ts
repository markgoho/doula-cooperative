import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { isActiveStripeMember } from "../../types/member-document.js";
import { type ReferralDetail } from "../schemas/referral-schemas.js";
import { toReferralDetail } from "../schemas/to-referral-detail.js";
import type { MemberService } from "../services/member/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

export async function getReferralLogic({
  memberId,
  requestId,
  memberService,
  referralsService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  requestId: string;
  memberService: MemberService;
  referralsService: ReferralsService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<ReferralDetail | { error: string }> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(authorizationHeader, memberId);
    const isAdmin = decodedToken["admin"] === true;

    if (!isAdmin) {
      const member = await memberService.findById(memberId);
      if (!isActiveStripeMember(member)) {
        set.status = 403;
        return { error: "Active membership required to view referrals" };
      }
    }

    const { id, document } = await referralsService.getReferral(requestId, logger);
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
