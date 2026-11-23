import {
  MARK_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../../constants/email-addresses.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { ADMIN_APP_URL } from "../../constants/urls.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";

/** One failed step of a sweep. `matchRequestId` is absent for a sweep-wide failure. */
export interface NoOutreachSweepFailure {
  matchRequestId?: string;
  step: string;
  error: unknown;
}

/**
 * One Admin Failure Notification for every failure in a sweep. Carries only
 * Match Request IDs, the failed step and the error type (never the error
 * message). Logs CRITICAL when the alert itself cannot be sent; never throws.
 */
export async function sendNoOutreachSweepFailureAlert({
  failures,
  emailService,
  logger,
}: {
  failures: NoOutreachSweepFailure[];
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  const failureItems = failures
    .map(failure => toFailureItem(failure))
    .join("\n");

  try {
    await emailService.sendEmail(
      {
        message: {
          from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
          to: [MARK_EMAIL, REFERRAL_EMAIL],
          subject: `No-Outreach Alert sweep had ${failures.length} failure(s)`,
          html: `
            <h2>No-Outreach Alert sweep failed</h2>
            <p>Some unanswered Referrals may not have been alerted. Tomorrow's sweep retries every Referral still without an alert.</p>
            <ul>
              ${failureItems}
            </ul>
            <p>See function logs for details.</p>
          `,
        },
      },
      logger,
    );
    logger.info("Sent No-Outreach Alert sweep failure alert", {
      failureCount: failures.length,
    });
  } catch (alertError) {
    logger.error(
      "CRITICAL: No-Outreach Alert sweep failed AND admin alert failed",
      {
        errorId: ERROR_IDS.NO_OUTREACH_ALERT_FAILURE_ALERT_FAILED,
        severity: "CRITICAL",
        context: "No-Outreach Alert sweep failed AND admin alert email failed",
        failures,
        alertError,
      },
    );
  }
}

function toFailureItem({
  matchRequestId,
  step,
  error,
}: NoOutreachSweepFailure): string {
  const errorType = error instanceof Error ? error.name : "Unknown error";

  if (matchRequestId === undefined) {
    return `<li><strong>Sweep:</strong> ${escapeHtml(step)} (${escapeHtml(errorType)})</li>`;
  }

  const detailUrl = `${ADMIN_APP_URL}/match-requests/${encodeURIComponent(matchRequestId)}`;
  return `<li><a href="${escapeHtml(detailUrl)}">${escapeHtml(matchRequestId)}</a>: ${escapeHtml(step)} (${escapeHtml(errorType)})</li>`;
}
