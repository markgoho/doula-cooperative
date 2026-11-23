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

/**
 * Admin Failure Notification for a Referral Notification that will not be
 * retried. Logs CRITICAL when the alert itself cannot be sent; never throws,
 * so the trigger stops retrying either way.
 */
export async function sendReferralNotificationFailureAlert({
  matchRequestId,
  error,
  emailService,
  logger,
}: {
  matchRequestId: string;
  error: unknown;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  const detailUrl = `${ADMIN_APP_URL}/match-requests/${encodeURIComponent(matchRequestId)}`;
  const errorType = error instanceof Error ? error.name : "Unknown error";

  try {
    await emailService.sendEmail(
      {
        message: {
          from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
          to: [MARK_EMAIL, REFERRAL_EMAIL],
          subject: `Referral Notification failed: ${matchRequestId}`,
          html: `
            <h2>Referral Notification failed</h2>
            <p>Members were not emailed about a new Match Request, and the trigger has stopped retrying.</p>
            <ul>
              <li><strong>Match Request ID:</strong> ${escapeHtml(matchRequestId)}</li>
              <li><strong>Error:</strong> ${escapeHtml(errorType)} (see function logs)</li>
            </ul>
            <p><a href="${escapeHtml(detailUrl)}">View match request in the admin app</a></p>
            <p><strong>Action Required:</strong> Share this referral with Members manually.</p>
          `,
        },
      },
      logger,
    );
    logger.info("Sent Referral Notification failure alert", {
      matchRequestId,
    });
  } catch (alertError) {
    logger.error(
      "CRITICAL: Referral Notification failed AND admin alert failed",
      {
        errorId: ERROR_IDS.REFERRAL_NOTIFICATION_ALERT_FAILED,
        severity: "CRITICAL",
        context: "Referral Notification failed AND admin alert email failed",
        matchRequestId,
        error,
        alertError,
      },
    );
  }
}
