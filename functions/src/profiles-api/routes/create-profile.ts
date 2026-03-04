import { ERROR_IDS } from "../../constants/error-ids.js";
import { MARK_EMAIL, NO_REPLY_EMAIL, MEMBERS_APP_URL } from "../../constants/index.js";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type {
  CreateProfileResponse,
  ProfileData,
} from "../schemas/profile-schemas.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import type { ProfileStoreService } from "../services/profile-store/interface.js";

function createNewProfileNotificationHtml({
  memberName,
  slug,
  uid,
}: {
  memberName: string;
  slug: string;
  uid: string;
}): string {
  const profileUrl = `https://doulacooperative.com/doulas/${escapeHtml(slug)}/`;
  const adminUrl = `${MEMBERS_APP_URL}/admin/members/${escapeHtml(uid)}`;
  return `
    <h2>New Doula Profile Created</h2>
    <p>A new member has created their doula profile and it needs to be reviewed before publishing.</p>
    <h3>Details:</h3>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(memberName)}</li>
      <li><strong>Profile Slug:</strong> ${escapeHtml(slug)}</li>
      <li><strong>Profile URL (once published):</strong> <a href="${profileUrl}">${profileUrl}</a></li>
      <li><strong>Admin Review:</strong> <a href="${adminUrl}">Review in Admin Dashboard</a></li>
    </ul>
    <p>The profile is currently set to <strong>draft: true</strong> and will not appear on the public site until you set it to <code>draft: false</code>.</p>
  `;
}

async function sendNewProfileNotification({
  memberName,
  slug,
  uid,
  emailService,
  logger,
}: {
  memberName: string;
  slug: string;
  uid: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: MARK_EMAIL,
      subject: `New Profile Needs Review: ${memberName}`,
      html: createNewProfileNotificationHtml({ memberName, slug, uid }),
    };
    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent new profile notification email", { slug, memberName });
  } catch (error: unknown) {
    logger.error("Failed to send new profile notification email", {
      errorId: ERROR_IDS.CREATE_PROFILE_NOTIFICATION_FAILED,
      slug,
      memberName,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function createProfileLogic({
  uid,
  data,
  profileStoreService,
  profileMemberService,
  emailService,
  logger,
  set,
}: {
  uid: string;
  data: ProfileData;
  profileStoreService: ProfileStoreService;
  profileMemberService: ProfileMemberService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<CreateProfileResponse> {
  try {
    const member = await profileMemberService.verifyActiveMembership(uid);

    const slug = member.slug;
    if (!slug) {
      throw new ForbiddenError(
        "Profile slug not found. User must create a slug first.",
      );
    }

    await profileStoreService.createProfile({ slug, data, ownerUid: uid });
    await profileMemberService.setProfileCreatedAt(uid);

    // Trigger Hugo rebuild (non-critical)
    try {
      const { triggerHugoRebuild } = await import(
        "../services/profile-store/trigger-rebuild.js"
      );
      await triggerHugoRebuild({ slug, action: "created profile" });
    } catch (error: unknown) {
      logger.error("Failed to trigger Hugo rebuild after create", {
        uid,
        slug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    logger.info("Successfully created profile", { uid, slug });
    set.status = 201;

    await sendNewProfileNotification({
      memberName: data.title,
      slug,
      uid,
      emailService,
      logger,
    });

    return { success: true, profile: data };
  } catch (error) {
    const errorResponse = handleRouteError({
      error,
      operation: "created profile",
      errorId: ERROR_IDS.API_PROFILE_CREATE_FAILED,
      logger,
      set,
      context: { uid },
    });
    return errorResponse as CreateProfileResponse;
  }
}
