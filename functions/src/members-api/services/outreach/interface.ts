import type { EmailMessage } from "../../../shared-api/services/email/index.js";
import type { Logger } from "../../../shared-api/types/logger.js";

/**
 * Result of claiming the right to send this Member's Outreach on a Referral.
 * - `reserved`: no Outreach yet and none in flight; the caller may send.
 * - `already_sent`: the Member already sent Outreach on this Referral.
 * - `in_progress`: another request from this Member is sending right now.
 */
export type OutreachReservation = "reserved" | "already_sent" | "in_progress";

export interface OutreachTarget {
  requestId: string;
  memberUid: string;
}

export interface OutreachService {
  /** Atomically mark an Outreach send as in flight, unless one was sent or is in flight. */
  reserveOutreach(
    target: OutreachTarget & { now: Date },
    logger: Logger,
  ): Promise<OutreachReservation>;
  /** Record an accepted Outreach (metadata only) and clear the in-flight mark. */
  recordOutreach(
    target: OutreachTarget & { sentAt: Date; mailgunMessageId?: string },
    logger: Logger,
  ): Promise<void>;
  /** Clear the in-flight mark after a failed send, leaving nothing recorded. */
  releaseOutreach(target: OutreachTarget, logger: Logger): Promise<void>;
  /** Send the Outreach email; resolves once Mailgun accepts it. */
  sendOutreachEmail(
    parameters: { message: EmailMessage },
    logger: Logger,
  ): Promise<{ mailgunMessageId?: string }>;
  /** Public Doula Profile URL for this slug, or undefined when it is missing or a draft. */
  findPublishedProfileUrl(
    slug: string | undefined,
    logger: Logger,
  ): Promise<string | undefined>;
}
