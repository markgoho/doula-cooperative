import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberDocument } from "../../types/member-document.js";
import { canViewReferralResponses } from "../access/can-view-referral-responses.js";
import { canViewReferral } from "../access/can-view-referral.js";
import { isReferralOpen } from "../access/is-referral-open.js";
import { REFERRAL_PORTAL_DENIAL } from "../access/referral-portal-denial.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import { type ReferralDetail } from "../schemas/referral-schemas.js";
import { summarizeMemberResponses } from "../schemas/summarize-member-responses.js";
import { toReferralCoordinatorView } from "../schemas/to-referral-coordinator-view.js";
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

    const [{ id, document }, responses, legacyResponses] = await Promise.all([
      referralsService.getReferral(requestId, logger),
      referralsService.listMemberResponses(requestId, logger),
      referralsService.listLegacyResponses(requestId, logger),
    ]);
    // The viewer's own responses decide the window, and only their own
    // Outreach decides the reveal, so an Admin on another Member's path never
    // gets contact details for free, nor does an Offline Response.
    const summary = summarizeMemberResponses(
      responses,
      decodedToken.uid,
      legacyResponses,
    );

    if (
      !canViewReferral({
        decodedToken,
        document,
        hasOwnResponse:
          summary.ownOutreachSentAt !== undefined ||
          summary.ownOfflineResponse !== undefined,
      })
    ) {
      set.status = 404;
      return REFERRAL_NOT_OPEN;
    }

    // Outreach can only be sent while the Referral is open, for everyone.
    const isOpen = isReferralOpen(document);
    const outreachSender =
      isOpen &&
      summary.ownOutreachSentAt === undefined &&
      decodedToken.uid === memberId
        ? await loadOutreachSender({
            loadMember,
            fallbackEmail: decodedToken.email,
            outreachService,
            logger,
          })
        : undefined;

    const detail = toReferralDetail(id, document, {
      ...summary,
      outreachSender,
      isOpen,
    });
    if (!canViewReferralResponses(decodedToken)) return detail;

    // Coordinator panel: who sent Outreach, each Member's Referral Outcome,
    // and the Offline Responses. Never the requester's contact details; those
    // still follow the viewer's own Outreach only.
    const names = await memberService.findNamesByIds([
      ...new Set([
        ...responses
          .filter(
            response =>
              response.outreachSentAt !== undefined ||
              response.offlineResponse !== undefined,
          )
          .map(response => response.memberUid),
        ...responses.flatMap(response =>
          response.offlineResponse ? [response.offlineResponse.recordedBy] : [],
        ),
        ...legacyResponses.map(response => response.recordedBy),
      ]),
    ]);
    return {
      ...detail,
      coordinator: toReferralCoordinatorView({
        responses,
        legacyResponses,
        names,
        decodedToken,
      }),
    };
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
