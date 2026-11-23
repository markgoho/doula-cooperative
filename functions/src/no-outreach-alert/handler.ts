import { logger as firebaseLogger } from "firebase-functions/v2";
import { ERROR_IDS } from "../constants/error-ids.js";
import { EmailService } from "../shared-api/services/email/index.js";
import { ReferralPortalSettingsService } from "../shared-api/services/referral-portal-settings/index.js";
import { NoOutreachAlertStore } from "./services/index.js";
import type {
  NoOutreachAlertServices,
  NotifiedMatchRequest,
} from "./types/services.js";
import { buildNoOutreachAlert } from "./utils/build-no-outreach-alert.js";
import { isReferralAnswered } from "./utils/is-referral-answered.js";
import {
  type NoOutreachSweepFailure,
  sendNoOutreachSweepFailureAlert,
} from "./utils/send-no-outreach-sweep-failure-alert.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Referral is unanswered once its Referral Notification is this old. */
const ALERT_AFTER_DAYS = 3;

/**
 * Firestore can't query a missing `noOutreachAlertSentAt`, so the scan is
 * bounded to Referral Notifications sent within this many days instead.
 */
const SCAN_WINDOW_DAYS = 30;

const DEFAULT_SERVICES: NoOutreachAlertServices = {
  emailService: EmailService,
  referralPortalSettingsService: ReferralPortalSettingsService,
  noOutreachAlertStore: NoOutreachAlertStore,
  logger: firebaseLogger,
};

/**
 * Daily No-Outreach Alert sweep.
 *
 * - Switch off → nothing sent.
 * - Selects Match Requests whose Referral Notification went out 3 to 30 days
 *   ago and that have no `noOutreachAlertSentAt`.
 * - Skips a Referral with any Outreach or Offline Response (Member or Legacy
 *   Membership). The admin "processed" (`sent`) mark does not suppress it.
 * - Sends one alert per unanswered Referral, then sets the marker (one-shot).
 * - A per-Referral failure is logged and the sweep continues; tomorrow's
 *   sweep retries it because the marker stays unset. A sweep with any failure
 *   sends one Admin Failure Notification. A sweep-wide failure is rethrown
 *   after that notification.
 */
export async function handleNoOutreachAlertSweep({
  services = DEFAULT_SERVICES,
  now = () => new Date(),
}: {
  services?: NoOutreachAlertServices;
  now?: () => Date;
} = {}): Promise<void> {
  const { emailService, logger } = services;
  const failures: NoOutreachSweepFailure[] = [];

  try {
    await sweep({ services, now: now(), failures });
  } catch (error) {
    logger.error("No-Outreach Alert sweep failed", {
      errorId: ERROR_IDS.NO_OUTREACH_ALERT_SWEEP_FAILED,
      error,
    });
    failures.push({ step: "Sweep did not finish", error });
    await sendNoOutreachSweepFailureAlert({ failures, emailService, logger });
    throw error;
  }

  if (failures.length > 0) {
    await sendNoOutreachSweepFailureAlert({ failures, emailService, logger });
  }
}

async function sweep({
  services,
  now,
  failures,
}: {
  services: NoOutreachAlertServices;
  now: Date;
  failures: NoOutreachSweepFailure[];
}): Promise<void> {
  const { referralPortalSettingsService, noOutreachAlertStore, logger } =
    services;

  const { v2Enabled } =
    await referralPortalSettingsService.getReferralPortalSettings();
  if (!v2Enabled) {
    logger.info("Referral Portal v2 is off; skipping No-Outreach Alert sweep");
    return;
  }

  const candidates =
    await noOutreachAlertStore.listMatchRequestsNotifiedBetween({
      from: new Date(now.getTime() - SCAN_WINDOW_DAYS * DAY_MS),
      to: new Date(now.getTime() - ALERT_AFTER_DAYS * DAY_MS),
    });

  let alertCount = 0;
  for (const candidate of candidates) {
    const isAlerted = await alertIfUnanswered({
      candidate,
      services,
      now,
      failures,
    });
    if (isAlerted) {
      alertCount += 1;
    }
  }

  logger.info("No-Outreach Alert sweep finished", {
    candidateCount: candidates.length,
    alertCount,
    failureCount: failures.length,
  });
}

/** Returns true when an alert was sent. Records failures instead of throwing. */
async function alertIfUnanswered({
  candidate: { id: matchRequestId, matchRequest },
  services: { emailService, noOutreachAlertStore, logger },
  now,
  failures,
}: {
  candidate: NotifiedMatchRequest;
  services: NoOutreachAlertServices;
  now: Date;
  failures: NoOutreachSweepFailure[];
}): Promise<boolean> {
  const { memberNotificationSentAt, noOutreachAlertSentAt } = matchRequest;
  if (
    memberNotificationSentAt === undefined ||
    noOutreachAlertSentAt !== undefined
  ) {
    return false;
  }

  try {
    const responses =
      await noOutreachAlertStore.listReferralResponses(matchRequestId);
    if (isReferralAnswered(responses)) {
      return false;
    }
  } catch (error) {
    logger.error("No-Outreach Alert: could not read Referral responses", {
      errorId: ERROR_IDS.NO_OUTREACH_ALERT_RESPONSES_READ_FAILED,
      matchRequestId,
      error,
    });
    failures.push({ matchRequestId, step: "Reading responses", error });
    return false;
  }

  const daysSinceNotification = Math.floor(
    (now.getTime() - memberNotificationSentAt.toMillis()) / DAY_MS,
  );

  try {
    await emailService.sendEmail(
      {
        message: buildNoOutreachAlert({
          matchRequest,
          matchRequestId,
          daysSinceNotification,
        }),
      },
      logger,
    );
  } catch (error) {
    logger.error("No-Outreach Alert send failed; will retry tomorrow", {
      errorId: ERROR_IDS.NO_OUTREACH_ALERT_SEND_FAILED,
      matchRequestId,
      error,
    });
    failures.push({ matchRequestId, step: "Sending the alert", error });
    return false;
  }

  // Mailgun accepted. A failed marker write means tomorrow's sweep alerts
  // again; that duplicate is acceptable, so log CRITICAL and move on.
  try {
    await noOutreachAlertStore.markNoOutreachAlertSent(matchRequestId);
  } catch (error) {
    logger.error("CRITICAL: No-Outreach Alert sent but marker write failed", {
      errorId: ERROR_IDS.NO_OUTREACH_ALERT_MARKER_WRITE_FAILED,
      severity: "CRITICAL",
      context:
        "Tomorrow's sweep will alert again; set noOutreachAlertSentAt manually",
      matchRequestId,
      error,
    });
    failures.push({
      matchRequestId,
      step: "Alert sent, but marking it failed (expect a repeat alert tomorrow)",
      error,
    });
    return true;
  }

  logger.info("Sent No-Outreach Alert", {
    matchRequestId,
    daysSinceNotification,
  });
  return true;
}
