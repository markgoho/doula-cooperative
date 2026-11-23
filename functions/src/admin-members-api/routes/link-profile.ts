import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import { sendAdminFailureNotification } from "../../shared-api/utils/send-admin-failure-notification.js";
import {
  toMemberResponse,
  type LinkProfileApiResponse,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";
import type { LinkProfileResult } from "../services/link-profile.js";

const CARRY_OVER_WARNING =
  "Profile linked, but the Legacy Membership's Offline Responses could not be carried over to this Member. Admins have been emailed the records to move by hand.";

interface CarryOverStatus {
  offlineResponsesCarried: boolean;
  warning?: string;
}

/**
 * Carry the linked Legacy Membership's Offline Responses over to the Member,
 * then delete its import record. The link itself already succeeded, so
 * failures are reported, never thrown. The import record is deleted even when
 * the carry-over fails: left behind, it would show as an Unclaimed Legacy
 * Membership whose deletion also deletes the now-linked profile.
 */
async function completeLegacyMembershipLink({
  memberId,
  memberEmail,
  slug,
  linkResult,
  memberAdminService,
  emailService,
  logger,
}: {
  memberId: string;
  memberEmail: string;
  slug: string;
  linkResult: LinkProfileResult;
  memberAdminService: MemberAdminService;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<CarryOverStatus> {
  const { legacyEmail, legacyLookupFailed } = linkResult;

  async function reportFailure(failure: string): Promise<CarryOverStatus> {
    await sendAdminFailureNotification({
      subject: `Offline Responses not carried over for ${memberEmail}`,
      title: "Offline Responses not carried over",
      description: `An Admin linked profile "${slug}" to this Member, but the Legacy Membership's Offline Responses could not be moved to them. Until they are moved, those Referrals don't show this Member's Offline Response and the Member can't record an Outcome on them.`,
      email: legacyEmail ?? memberEmail,
      memberId,
      failures: [failure],
      errorId:
        ERROR_IDS.API_ADMIN_LINK_PROFILE_OFFLINE_RESPONSES_CARRY_OVER_FAILED,
      emailService,
      logger,
    });
    return { offlineResponsesCarried: false, warning: CARRY_OVER_WARNING };
  }

  if (legacyLookupFailed === true) {
    return reportFailure(
      `Find this profile's Legacy Membership in migrated_users_import (slug "${slug}"), move its matchRequests/*/legacyResponses documents to matchRequests/*/memberResponses/${memberId}.offlineResponse (keep recordedBy and recordedAt), then delete the import record`,
    );
  }

  if (legacyEmail === undefined) {
    return { offlineResponsesCarried: true };
  }

  let didCarryOverFail = false;

  try {
    await memberAdminService.carryOverOfflineResponses({
      memberUid: memberId,
      legacyEmail,
      logger,
    });
  } catch (error) {
    didCarryOverFail = true;
    logger.error("Failed to carry Offline Responses over after admin link", {
      errorId:
        ERROR_IDS.API_ADMIN_LINK_PROFILE_OFFLINE_RESPONSES_CARRY_OVER_FAILED,
      memberId,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    await memberAdminService.deleteLegacyMembership({ legacyEmail });
    logger.info("Deleted import record after admin link", { memberId, slug });
  } catch (error) {
    logger.error("Failed to delete import record after admin link", {
      errorId: ERROR_IDS.API_ADMIN_LINK_PROFILE_IMPORT_DELETE_FAILED,
      memberId,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  if (didCarryOverFail) {
    return reportFailure(
      `Move every matchRequests/*/legacyResponses/${legacyEmail} document to matchRequests/*/memberResponses/${memberId}.offlineResponse (keep recordedBy and recordedAt; skip Referrals where the Member already has outreachSentAt or offlineResponse), then delete the legacy document`,
    );
  }

  return { offlineResponsesCarried: true };
}

/**
 * Route handler for POST /:memberId/profile/link.
 * Links an unlinked profile to a member account (Link Legacy Membership),
 * carrying the Legacy Membership's Offline Responses over to the Member.
 */
export async function linkProfileLogic({
  memberId,
  slug,
  adminUid,
  memberAdminService,
  emailService,
  logger,
  set,
}: {
  memberId: string;
  slug: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<LinkProfileApiResponse> {
  try {
    const result = await memberAdminService.linkProfile({ memberId, slug });

    let isAdmin = false;

    try {
      isAdmin = await memberAdminService.isAdmin(memberId, logger);
    } catch (error) {
      logger.error("Failed to enrich linked member with admin status", {
        errorId: ERROR_IDS.API_ADMIN_LINK_PROFILE_FAILED,
        adminUid,
        memberId,
        slug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const carryOverStatus = await completeLegacyMembershipLink({
      memberId,
      memberEmail: result.member.email,
      slug,
      linkResult: result,
      memberAdminService,
      emailService,
      logger,
    });

    logger.info("Admin linked profile to member", {
      adminUid,
      memberId,
      slug,
      offlineResponsesCarried: carryOverStatus.offlineResponsesCarried,
    });

    return {
      success: true,
      member: toMemberResponse(result.member, isAdmin),
      ...carryOverStatus,
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "link profile to member",
      errorId: ERROR_IDS.API_ADMIN_LINK_PROFILE_FAILED,
      logger,
      set,
      context: { adminUid, memberId, slug },
    });
  }
}
