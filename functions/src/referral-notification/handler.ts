import { logger as firebaseLogger } from "firebase-functions/v2";
import { ERROR_IDS } from "../constants/error-ids.js";
import { EmailError } from "../shared-api/services/email/errors.js";
import { EmailService } from "../shared-api/services/email/index.js";
import { ReferralPortalSettingsService } from "../shared-api/services/referral-portal-settings/index.js";
import { ReferralNotificationStore } from "./services/index.js";
import type { ReferralNotificationServices } from "./types/services.js";
import { buildReferralNotification } from "./utils/build-referral-notification.js";
import { chunkRecipients } from "./utils/chunk-recipients.js";
import { selectRecipientEmails } from "./utils/select-recipient-emails.js";
import { sendReferralNotificationFailureAlert } from "./utils/send-referral-notification-failure-alert.js";

/**
 * A trigger can't see its retry count, so an attempt that fails this long after
 * the Match Request was created is treated as the final one: the admin alert
 * goes out and the trigger stops retrying.
 */
const FINAL_ATTEMPT_AGE_MS = 60 * 60 * 1000;

const DEFAULT_SERVICES: ReferralNotificationServices = {
  emailService: EmailService,
  referralPortalSettingsService: ReferralPortalSettingsService,
  referralNotificationStore: ReferralNotificationStore,
  logger: firebaseLogger,
};

/**
 * Send the Referral Notification for a newly created Match Request.
 *
 * Runs from `onDocumentCreated` with retries on:
 * - Switch off → nothing sent, no marker.
 * - Marker already set → nothing sent (a retry after Mailgun accepted).
 * - Zero recipients → marker set, nothing sent.
 * - Failure → throws so the trigger retries; once the event is older than
 *   FINAL_ATTEMPT_AGE_MS (or Mailgun rejects permanently), sends an admin
 *   alert and returns instead.
 */
export async function handleReferralNotification({
  matchRequestId,
  eventTime,
  services = DEFAULT_SERVICES,
  now = () => new Date(),
}: {
  matchRequestId: string;
  eventTime: string;
  services?: ReferralNotificationServices;
  now?: () => Date;
}): Promise<void> {
  const { emailService, logger } = services;

  try {
    await sendOnce({ matchRequestId, services });
  } catch (error) {
    const eventAgeMs = now().getTime() - Date.parse(eventTime);
    const isPermanentMailgunError =
      error instanceof EmailError && !error.isRetryable;
    const isFinalAttempt =
      isPermanentMailgunError || eventAgeMs >= FINAL_ATTEMPT_AGE_MS;

    if (!isFinalAttempt) {
      logger.warn("Referral Notification attempt failed; will retry", {
        errorId: ERROR_IDS.REFERRAL_NOTIFICATION_ATTEMPT_FAILED,
        matchRequestId,
        eventAgeMs,
        error,
      });
      throw error;
    }

    logger.error("Referral Notification failed; giving up", {
      errorId: ERROR_IDS.REFERRAL_NOTIFICATION_FINAL_FAILURE,
      matchRequestId,
      eventAgeMs,
      isPermanentMailgunError,
      error,
    });
    await sendReferralNotificationFailureAlert({
      matchRequestId,
      error,
      emailService,
      logger,
    });
  }
}

async function sendOnce({
  matchRequestId,
  services: {
    emailService,
    referralPortalSettingsService,
    referralNotificationStore,
    logger,
  },
}: {
  matchRequestId: string;
  services: ReferralNotificationServices;
}): Promise<void> {
  const { v2Enabled } =
    await referralPortalSettingsService.getReferralPortalSettings();
  if (!v2Enabled) {
    logger.info("Referral Portal v2 is off; skipping Referral Notification", {
      matchRequestId,
    });
    return;
  }

  // The event snapshot is the creation snapshot on every retry, so read the
  // document fresh to see a marker written by an earlier attempt.
  const matchRequest =
    await referralNotificationStore.getMatchRequest(matchRequestId);
  if (matchRequest === undefined) {
    logger.warn("Match Request not found; skipping Referral Notification", {
      errorId: ERROR_IDS.REFERRAL_NOTIFICATION_MATCH_REQUEST_NOT_FOUND,
      matchRequestId,
    });
    return;
  }
  if (matchRequest.memberNotificationSentAt !== undefined) {
    logger.info("Referral Notification already sent; skipping", {
      matchRequestId,
    });
    return;
  }

  const recipientEmails = selectRecipientEmails(
    await referralNotificationStore.listMembersWithLiveSubscription(),
  );
  if (recipientEmails.length === 0) {
    logger.info("No Referral Notification recipients", { matchRequestId });
    // Nothing was sent, so a failed write here is safe to retry.
    await referralNotificationStore.markMemberNotificationSent(matchRequestId);
    return;
  }

  for (const chunk of chunkRecipients(recipientEmails)) {
    await emailService.sendEmail(
      {
        message: buildReferralNotification({
          matchRequest,
          matchRequestId,
          recipientEmails: chunk,
        }),
      },
      logger,
    );
  }

  // Mailgun accepted: a retry now would email every Member again, so a failed
  // marker write is logged CRITICAL instead of rethrown.
  try {
    await referralNotificationStore.markMemberNotificationSent(matchRequestId);
  } catch (markerError) {
    logger.error(
      "CRITICAL: Referral Notification sent but marker write failed",
      {
        errorId: ERROR_IDS.REFERRAL_NOTIFICATION_MARKER_WRITE_FAILED,
        severity: "CRITICAL",
        context:
          "Not retrying to avoid a duplicate send; set memberNotificationSentAt manually",
        matchRequestId,
        error: markerError,
      },
    );
    return;
  }

  logger.info("Sent Referral Notification", {
    matchRequestId,
    recipientCount: recipientEmails.length,
  });
}
