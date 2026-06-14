import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { isActiveStripeMember } from "../../types/member-document.js";
import { type ListReferralsResponse } from "../schemas/referral-schemas.js";
import { toReferralListItem } from "../schemas/to-referral-list-item.js";
import type { MemberService } from "../services/member/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

export async function listReferralsLogic({
  memberId,
  memberService,
  referralsService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  memberService: MemberService;
  referralsService: ReferralsService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<ListReferralsResponse | { error: string }> {
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

    const items = await referralsService.listReferrals(logger);
    return {
      referrals: items.map(({ id, document }) => toReferralListItem(id, document)),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to list referrals", {
      errorId: ERROR_IDS.API_MEMBER_LIST_REFERRALS_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
    });

    set.status = 500;
    return { error: "Failed to retrieve referrals" };
  }
}
