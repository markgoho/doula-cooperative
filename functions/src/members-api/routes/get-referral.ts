import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberDocument } from "../../types/member-document.js";
import { canViewReferral } from "../access/can-view-referral.js";
import { REFERRAL_PORTAL_DENIAL } from "../access/referral-portal-denial.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import { type ReferralDetail } from "../schemas/referral-schemas.js";
import { summarizeMemberResponses } from "../schemas/summarize-member-responses.js";
import { toReferralDetail } from "../schemas/to-referral-detail.js";
import type { MemberService } from "../services/member/interface.js";
import type { OutreachService } from "../services/outreach/interface.js";
import { loadOutreachSender } from "../services/outreach/load-outreach-sender.js";
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
  outreachService,
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
  outreachService: OutreachService;
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
    let memberPromise: Promise<MemberDocument> | undefined;
    const loadMember = () =>
      (memberPromise ??= memberService.findById(memberId));

    const access = await resolveReferralPortalAccess({
      decodedToken,
      loadMember,
      referralPortalSettingsService,
      logger,
    });

    if (access !== "allowed") {
      set.status = 403;
      return REFERRAL_PORTAL_DENIAL[access];
    }

    const [{ id, document }, responses] = await Promise.all([
      referralsService.getReferral(requestId, logger),
      referralsService.listMemberResponses(requestId, logger),
    ]);
    // The viewer's own Outreach decides the window and the reveal, so an
    // Admin on another Member's path never gets contact details for free.
    const summary = summarizeMemberResponses(responses, decodedToken.uid);

    if (
      !canViewReferral({
        decodedToken,
        document,
        hasOutreach: summary.ownOutreachSentAt !== undefined,
      })
    ) {
      set.status = 404;
      return REFERRAL_NOT_OPEN;
    }

    const outreachSender =
      summary.ownOutreachSentAt === undefined && decodedToken.uid === memberId
        ? await loadOutreachSender({
            loadMember,
            fallbackEmail: decodedToken.email,
            outreachService,
            logger,
          })
        : undefined;

    return toReferralDetail(id, document, { ...summary, outreachSender });
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
