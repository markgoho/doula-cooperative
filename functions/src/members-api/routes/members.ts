import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import {
  toMemberResponse,
  type MemberResponse,
} from "../schemas/member-schemas.js";
import type { MemberService } from "../services/member/interface.js";

/**
 * Get a member by ID logic (authenticated).
 * Requires authentication - users can access their own data, or admins can access any member.
 * Includes `referralPortalAvailable` so the members app never reads the Referral Portal switch itself.
 *
 * @returns Member data or error object
 */
export async function getMemberLogic({
  memberId,
  memberService,
  authService,
  referralPortalSettingsService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  memberService: MemberService;
  authService: AuthService;
  referralPortalSettingsService: ReferralPortalSettingsService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<MemberResponse | { error: string }> {
  try {
    // Verify authentication and authorization using injected service
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    // Audit log successful access
    const isAdmin = decodedToken["admin"] === true;
    logger.info("Authorized member access", {
      requestingUser: decodedToken.uid,
      targetMember: memberId,
      isAdmin,
    });

    // Fetch member data using injected service
    const member = await memberService.findById(memberId);

    // A settings read failure must not break the membership page; the
    // resolver logs it, and the portal link is simply hidden.
    let isReferralPortalAvailable = false;
    try {
      const access = await resolveReferralPortalAccess({
        decodedToken,
        loadMember: () => Promise.resolve(member),
        referralPortalSettingsService,
        logger,
      });
      isReferralPortalAvailable = access === "allowed";
    } catch {
      // Already logged with API_MEMBER_REFERRAL_PORTAL_SETTINGS_READ_FAILED
    }

    return {
      ...toMemberResponse(member, isAdmin),
      referralPortalAvailable: isReferralPortalAvailable,
    };
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Log unexpected errors with context
    const errorContext = {
      errorId: ERROR_IDS.API_MEMBER_FETCH_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      ...(error !== null &&
        typeof error === "object" &&
        "constructor" in error && { errorType: error.constructor.name }),
      memberId,
      hasAuthorizationHeader: !!authorizationHeader,
    };

    logger.error("Failed to fetch member data", errorContext);

    set.status = 500;
    return { error: "Failed to retrieve member data" };
  }
}
