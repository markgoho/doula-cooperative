import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canViewReferral } from "../access/can-view-referral.js";
import { isReferralCoordinator } from "../access/is-referral-coordinator.js";
import { isReferralOpen } from "../access/is-referral-open.js";
import { REFERRAL_PORTAL_DENIAL } from "../access/referral-portal-denial.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import { type ListReferralsResponse } from "../schemas/referral-schemas.js";
import { summarizeMemberResponses } from "../schemas/summarize-member-responses.js";
import { toReferralListItem } from "../schemas/to-referral-list-item.js";
import type { MemberService } from "../services/member/interface.js";
import type {
  ReferralItem,
  ReferralsService,
} from "../services/referrals/interface.js";

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

    // A Referral Coordinator sees every Referral (newest 200); everyone else
    // sees open Referrals.
    const isListingAll = isReferralCoordinator(decodedToken);

    // Those, plus older ones the viewer responded to (Outreach or an Offline
    // Response naming them; the My Outreach filter).
    // If the older ones can't be read (e.g. the collection-group index is
    // missing), still list open Referrals rather than failing the inbox.
    const listReachedOut = async (): Promise<ReferralItem[]> => {
      try {
        return await referralsService.listReferralsWithMemberResponse(
          decodedToken.uid,
          logger,
        );
      } catch (error) {
        logger.error(
          "Failed to list reached-out referrals; listing open only",
          {
            errorId: ERROR_IDS.API_MEMBER_LIST_REACHED_OUT_REFERRALS_FAILED,
            error,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            memberId,
          },
        );
        return [];
      }
    };
    const [primary, responded] = await Promise.all([
      isListingAll
        ? referralsService.listAllReferrals(logger)
        : referralsService.listReferrals(logger),
      listReachedOut(),
    ]);
    const primaryIds = new Set(primary.map(item => item.id));
    const candidates = [
      ...primary,
      ...responded.filter(item => !primaryIds.has(item.id)),
    ];

    const now = new Date();
    const listed = await Promise.all(
      candidates.map(async ({ id, document }) => {
        const [responses, legacyResponses] = await Promise.all([
          referralsService.listMemberResponses(id, logger),
          referralsService.listLegacyResponses(id, logger),
        ]);
        const summary = summarizeMemberResponses(
          responses,
          decodedToken.uid,
          legacyResponses,
        );
        const isVisible = canViewReferral({
          decodedToken,
          document,
          hasOwnResponse:
            summary.ownOutreachSentAt !== undefined ||
            summary.ownOfflineResponse !== undefined,
          now,
        });
        if (!isVisible) return;
        return toReferralListItem(id, document, {
          ...summary,
          isOpen: isReferralOpen(document, now),
        });
      }),
    );

    return {
      showsAllReferrals: isListingAll,
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
