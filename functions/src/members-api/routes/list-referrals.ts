import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canViewReferral } from "../access/can-view-referral.js";
import { referralOpenCutoff } from "../access/referral-open-cutoff.js";
import { REFERRAL_PORTAL_DENIAL } from "../access/referral-portal-denial.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import { type ListReferralsResponse } from "../schemas/referral-schemas.js";
import { summarizeMemberResponses } from "../schemas/summarize-member-responses.js";
import { toReferralListItem } from "../schemas/to-referral-list-item.js";
import type { MemberService } from "../services/member/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

export async function listReferralsLogic({
  memberId,
  memberService,
  referralsService,
  referralPortalSettingsService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  memberService: MemberService;
  referralsService: ReferralsService;
  referralPortalSettingsService: ReferralPortalSettingsService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<ListReferralsResponse | { error: string; code?: string }> {
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

    // Open Referrals, plus older ones the viewer responded to (My Outreach).
    const [open, responded] = await Promise.all([
      referralsService.listReferrals(logger),
      referralsService.listReferralsWithMemberResponse(
        decodedToken.uid,
        logger,
      ),
    ]);
    const openIds = new Set(open.map(item => item.id));
    const candidates = [
      ...open,
      ...responded.filter(item => !openIds.has(item.id)),
    ];

    const now = new Date();
    const cutoffMs = referralOpenCutoff(now).getTime();
    const listed = await Promise.all(
      candidates.map(async ({ id, document }) => {
        const summary = summarizeMemberResponses(
          await referralsService.listMemberResponses(id, logger),
          decodedToken.uid,
        );
        const isVisible = canViewReferral({
          decodedToken,
          document,
          hasOutreach: summary.ownOutreachSentAt !== undefined,
          now,
        });
        if (!isVisible) return;
        return toReferralListItem(id, document, {
          ...summary,
          isOpen: document.submitted.toMillis() >= cutoffMs,
        });
      }),
    );

    return {
      referrals: listed
        .filter(item => item !== undefined)
        .toSorted((a, b) => b.submitted.localeCompare(a.submitted)),
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
