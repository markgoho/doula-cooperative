import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { sendAdminFailureNotification } from "../../shared-api/utils/send-admin-failure-notification.js";
import type { MemberDocument } from "../../types/member-document.js";
import { isReferralOpen } from "../access/is-referral-open.js";
import { REFERRAL_PORTAL_DENIAL } from "../access/referral-portal-denial.js";
import { resolveReferralPortalAccess } from "../access/resolve-referral-portal-access.js";
import type { SendOutreachResponse } from "../schemas/referral-schemas.js";
import { summarizeMemberResponses } from "../schemas/summarize-member-responses.js";
import type { MemberService } from "../services/member/interface.js";
import { buildOutreachEmail } from "../services/outreach/build-outreach-email.js";
import type {
  OutreachReservation,
  OutreachService,
} from "../services/outreach/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

interface ErrorBody {
  error: string;
  code?: string;
}

const OUTREACH_ERRORS = {
  notSelf: {
    error: "You can only send Outreach as yourself",
    code: "OUTREACH_NOT_SELF",
  },
  messageRequired: {
    error: "Write a message before sending Outreach",
    code: "OUTREACH_MESSAGE_REQUIRED",
  },
  notOpen: {
    error: "This referral is no longer open",
    code: "REFERRAL_NOT_OPEN",
  },
  sendFailed: {
    error:
      "Your message wasn't sent, and nothing was shared. Please try again.",
    code: "OUTREACH_SEND_FAILED",
  },
  recordFailed: {
    error:
      "Your message was sent, but we couldn't save it. Please don't send it again; the co-op has been notified.",
    code: "OUTREACH_RECORD_FAILED",
  },
} satisfies Record<string, ErrorBody>;

const RESERVATION_CONFLICTS: Record<
  Exclude<OutreachReservation, "reserved">,
  ErrorBody
> = {
  already_sent: {
    error: "You already sent Outreach on this referral",
    code: "OUTREACH_ALREADY_SENT",
  },
  in_progress: {
    error: "Your Outreach on this referral is already being sent",
    code: "OUTREACH_IN_PROGRESS",
  },
};

/** Tries at recording an accepted Outreach before reporting a failure. */
const RECORD_ATTEMPTS = 3;

async function retry(operation: () => Promise<void>, attempts: number) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
    }
  }
}

/**
 * Send this Member's one Outreach on a Referral.
 *
 * Reserve, send, then record: an in-flight mark stops a double submit from
 * sending twice. If Mailgun rejects the send, the mark is cleared and nothing
 * is recorded or revealed. If Mailgun accepts it, the metadata (never the
 * message body) is recorded and the requester's contact details are returned.
 */
export async function sendOutreachLogic({
  memberId,
  requestId,
  message,
  memberService,
  referralsService,
  referralPortalSettingsService,
  outreachService,
  authService,
  emailService,
  logger,
  authorizationHeader,
  set,
  now = () => new Date(),
}: {
  memberId: string;
  requestId: string;
  message: string;
  memberService: MemberService;
  referralsService: ReferralsService;
  referralPortalSettingsService: ReferralPortalSettingsService;
  outreachService: OutreachService;
  authService: AuthService;
  emailService: EmailServiceInterface;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
  now?: () => Date;
}): Promise<SendOutreachResponse | ErrorBody> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );
    // Admins pass verifyOwnerOrAdmin, but never send Outreach for someone else.
    if (decodedToken.uid !== memberId) {
      set.status = 403;
      return OUTREACH_ERRORS.notSelf;
    }

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

    const body = message.trim();
    if (body === "") {
      set.status = 400;
      return OUTREACH_ERRORS.messageRequired;
    }

    const { document } = await referralsService.getReferral(requestId, logger);
    const { ownOutreachSentAt } = summarizeMemberResponses(
      await referralsService.listMemberResponses(requestId, logger),
      memberId,
    );
    if (ownOutreachSentAt) {
      set.status = 409;
      return RESERVATION_CONFLICTS.already_sent;
    }
    // Open Referrals only, for everyone: Admins and Referral Coordinators may
    // view older Referrals, but not reach out on them.
    if (!isReferralOpen(document, now())) {
      set.status = 403;
      return OUTREACH_ERRORS.notOpen;
    }

    const member = await loadMember();
    const profileUrl = await outreachService.findPublishedProfileUrl(
      member.slug,
      logger,
    );
    const memberEmail =
      member.email.trim() === "" ? (decodedToken.email ?? "") : member.email;
    const email = buildOutreachEmail({
      memberName: member.name ?? "",
      memberEmail,
      requesterEmail: document.email,
      message: body,
      profileUrl,
    });

    const target = { requestId, memberUid: memberId };
    const reservation = await outreachService.reserveOutreach(
      { ...target, now: now() },
      logger,
    );
    if (reservation !== "reserved") {
      set.status = 409;
      return RESERVATION_CONFLICTS[reservation];
    }

    let mailgunMessageId: string | undefined;
    try {
      ({ mailgunMessageId } = await outreachService.sendOutreachEmail(
        { message: email },
        logger,
      ));
    } catch (error) {
      // The message body is never logged.
      logger.error("Outreach email was not accepted by Mailgun", {
        errorId: ERROR_IDS.API_MEMBER_OUTREACH_EMAIL_FAILED,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        memberId,
        requestId,
      });
      try {
        await outreachService.releaseOutreach(target, logger);
      } catch {
        // Logged by the service; the in-flight mark expires on its own.
      }
      set.status = 502;
      return OUTREACH_ERRORS.sendFailed;
    }

    const sentAt = now();
    const record = {
      ...target,
      sentAt,
      ...(mailgunMessageId !== undefined && { mailgunMessageId }),
    };
    try {
      // The email is already out, so retry the idempotent write before giving up.
      await retry(
        () => outreachService.recordOutreach(record, logger),
        RECORD_ATTEMPTS,
      );
    } catch (error) {
      logger.error("Outreach sent but not recorded", {
        errorId: ERROR_IDS.API_MEMBER_OUTREACH_RECORD_FAILED,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        memberId,
        requestId,
        mailgunMessageId,
      });
      await sendAdminFailureNotification({
        subject: `Outreach sent but not recorded for ${memberEmail}`,
        title: "Outreach sent but not recorded",
        description: `Mailgun accepted this Member's Outreach on Referral ${requestId}, but saving it to Firestore failed. Record it by hand so the Member sees the contact details and can't send twice.`,
        email: memberEmail,
        memberId,
        failures: [
          `Write matchRequests/${requestId}/memberResponses/${memberId} with outreachSentAt ${sentAt.toISOString()}${mailgunMessageId ? ` and mailgunMessageId ${mailgunMessageId}` : ""}`,
        ],
        errorId: ERROR_IDS.API_MEMBER_OUTREACH_RECORD_FAILED,
        emailService,
        logger,
      });
      set.status = 500;
      return OUTREACH_ERRORS.recordFailed;
    }

    set.status = 201;
    return {
      outreach: { sentAt: sentAt.toISOString() },
      contact: {
        fullName: document.name,
        email: document.email,
        phone: document.phone,
      },
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to send Outreach", {
      errorId: ERROR_IDS.API_MEMBER_SEND_OUTREACH_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
      requestId,
    });

    set.status = 500;
    return { error: "Failed to send Outreach. Please try again." };
  }
}
