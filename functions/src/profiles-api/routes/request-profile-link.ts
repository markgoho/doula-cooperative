import { ADMIN_EMAIL } from "../../constants/admin.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { MEMBERS_APP_URL, NO_REPLY_EMAIL } from "../../constants/index.js";
import { ConflictError } from "../../shared-api/errors/http-error.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { RequestProfileLinkResponse } from "../schemas/profile-schemas.js";
import type { ProfileMemberService } from "../services/member/interface.js";

function createProfileLinkRequestNotificationHtml({
  memberName,
  memberEmail,
  uid,
  slug,
  profileTitle,
  adminUrl,
}: {
  memberName: string;
  memberEmail: string;
  uid: string;
  slug: string;
  profileTitle: string;
  adminUrl: string;
}): string {
  return `
    <h2>Profile Link Request</h2>
    <p>A member said an existing unclaimed profile belongs to them, instead of creating a new duplicate profile.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(memberName)}</li>
      <li><strong>Email:</strong> ${escapeHtml(memberEmail)}</li>
      <li><strong>UID:</strong> ${escapeHtml(uid)}</li>
      <li><strong>Matched Profile:</strong> ${escapeHtml(profileTitle)} (slug: ${escapeHtml(slug)})</li>
      <li><strong>Admin Member Detail:</strong> <a href="${adminUrl}">${adminUrl}</a></li>
    </ul>

    <p><strong>Action:</strong> Open the member detail page and use <strong>Link Existing Profile</strong> to confirm and link this profile.</p>
  `;
}

async function sendProfileLinkRequestNotification({
  memberName,
  memberEmail,
  uid,
  slug,
  profileTitle,
  emailService,
  logger,
}: {
  memberName: string;
  memberEmail: string;
  uid: string;
  slug: string;
  profileTitle: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  try {
    const adminUrl = `${MEMBERS_APP_URL}/admin/members/${escapeHtml(uid)}`;

    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `Profile link request: ${memberName} → ${slug}`,
      html: createProfileLinkRequestNotificationHtml({
        memberName,
        memberEmail,
        uid,
        slug,
        profileTitle,
        adminUrl,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent profile link request notification email", {
      uid,
      slug,
    });
  } catch (error: unknown) {
    logger.error("Failed to send profile link request notification email", {
      errorId: ERROR_IDS.PROFILE_LINK_REQUEST_NOTIFICATION_FAILED,
      uid,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      severity: "CRITICAL",
      actionRequired:
        "Manually check whether this member's profile still needs linking",
    });
  }
}

/**
 * Route logic for requesting an admin link a member's account to an
 * existing unowned profile, instead of creating a duplicate profile.
 * POST /api/profiles/slugs/link-request
 */
export async function requestProfileLinkLogic({
  uid,
  slug,
  profileMemberService,
  emailService,
  logger,
  set,
}: {
  uid: string;
  slug: string;
  profileMemberService: ProfileMemberService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<RequestProfileLinkResponse> {
  try {
    const member = await profileMemberService.verifyActiveMembership(uid);

    if (member.slug) {
      throw new ConflictError("You already have a profile slug.");
    }

    const availability = await profileMemberService.checkSlugAvailable(slug);
    if (!availability.unownedMatch) {
      throw new ConflictError(
        "This profile is no longer available to link. Please refresh and try again.",
      );
    }

    await sendProfileLinkRequestNotification({
      memberName: member.name ?? "Not provided",
      memberEmail: member.email,
      uid,
      slug,
      profileTitle: availability.unownedMatch.title,
      emailService,
      logger,
    });

    logger.info("Requested profile link", { uid, slug });
    return { success: true };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "request profile link",
      errorId: ERROR_IDS.API_PROFILE_LINK_REQUEST_FAILED,
      logger,
      set,
      context: { uid, slug },
    });
  }
}
