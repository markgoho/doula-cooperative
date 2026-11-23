import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../../collections/match-requests.js";
import {
  MEMBER_RESPONSES_SUBCOLLECTION,
  type MemberResponseDocument,
} from "../../../collections/member-responses.js";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../../collections/profiles.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { PUBLIC_SITE_URL } from "../../../constants/urls.js";
import type { EmailMessage } from "../../../shared-api/services/email/index.js";
import { sendMailgunMessage } from "../../../shared-api/services/email/send-mailgun-message.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import type {
  OutreachReservation,
  OutreachService,
  OutreachTarget,
} from "./interface.js";

/**
 * An in-flight mark older than this is treated as abandoned (the request
 * crashed mid-send), so the Member is not locked out of sending.
 */
const PENDING_OUTREACH_TIMEOUT_MS = 2 * 60 * 1000;

function memberResponseReference({ requestId, memberUid }: OutreachTarget) {
  return getFirestore()
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(requestId)
    .collection(MEMBER_RESPONSES_SUBCOLLECTION)
    .doc(memberUid);
}

function logWriteFailure(
  logger: Logger,
  message: string,
  errorId: string,
  target: OutreachTarget,
  error: unknown,
) {
  logger.error(message, {
    errorId,
    error,
    errorMessage: error instanceof Error ? error.message : "Unknown error",
    ...target,
  });
}

async function reserveOutreach(
  { requestId, memberUid, now }: OutreachTarget & { now: Date },
  logger: Logger,
): Promise<OutreachReservation> {
  const target = { requestId, memberUid };
  try {
    const reference = memberResponseReference(target);
    return await getFirestore().runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      const response = snapshot.data() as MemberResponseDocument | undefined;

      if (response?.outreachSentAt) return "already_sent";
      const pendingAt = response?.outreachPendingAt?.toMillis();
      if (
        pendingAt !== undefined &&
        now.getTime() - pendingAt < PENDING_OUTREACH_TIMEOUT_MS
      ) {
        return "in_progress";
      }

      transaction.set(
        reference,
        { memberUid, outreachPendingAt: Timestamp.fromDate(now) },
        { merge: true },
      );
      return "reserved";
    });
  } catch (error) {
    logWriteFailure(
      logger,
      "Failed to reserve Outreach in Firestore",
      ERROR_IDS.API_MEMBER_OUTREACH_RESERVE_FAILED,
      target,
      error,
    );
    throw error;
  }
}

async function recordOutreach(
  {
    requestId,
    memberUid,
    sentAt,
    mailgunMessageId,
  }: OutreachTarget & { sentAt: Date; mailgunMessageId?: string },
  logger: Logger,
): Promise<void> {
  const target = { requestId, memberUid };
  try {
    await memberResponseReference(target).set(
      {
        memberUid,
        outreachSentAt: Timestamp.fromDate(sentAt),
        ...(mailgunMessageId !== undefined && { mailgunMessageId }),
        outreachPendingAt: FieldValue.delete(),
      },
      { merge: true },
    );
  } catch (error) {
    logWriteFailure(
      logger,
      "Failed to record Outreach in Firestore",
      ERROR_IDS.API_MEMBER_OUTREACH_RECORD_FAILED,
      target,
      error,
    );
    throw error;
  }
}

/** Fields that only exist to support the in-flight mark. */
const RESERVATION_ONLY_FIELDS = new Set(["memberUid", "outreachPendingAt"]);

async function releaseOutreach(
  target: OutreachTarget,
  logger: Logger,
): Promise<void> {
  try {
    const reference = memberResponseReference(target);
    await getFirestore().runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      const response = snapshot.data();
      if (!response || response["outreachSentAt"]) return;

      const hasOtherData = Object.keys(response).some(
        field => !RESERVATION_ONLY_FIELDS.has(field),
      );
      if (hasOtherData) {
        transaction.update(reference, {
          outreachPendingAt: FieldValue.delete(),
        });
      } else {
        transaction.delete(reference);
      }
    });
  } catch (error) {
    logWriteFailure(
      logger,
      "Failed to release Outreach reservation in Firestore",
      ERROR_IDS.API_MEMBER_OUTREACH_RELEASE_FAILED,
      target,
      error,
    );
    throw error;
  }
}

async function sendOutreachEmail(
  { message }: { message: EmailMessage },
  logger: Logger,
): Promise<{ mailgunMessageId?: string }> {
  const { id } = await sendMailgunMessage({ message }, logger);
  return id === undefined ? {} : { mailgunMessageId: id };
}

async function findPublishedProfileUrl(
  slug: string | undefined,
  logger: Logger,
): Promise<string | undefined> {
  if (!slug) return undefined;
  try {
    const snapshot = await getFirestore()
      .collection(PROFILES_COLLECTION)
      .doc(slug)
      .get();
    if (!snapshot.exists) return undefined;
    const profile = snapshot.data() as ProfileDocument;
    if (profile.draft === true) return undefined;
    return `${PUBLIC_SITE_URL}/doulas/${encodeURIComponent(slug)}/`;
  } catch (error) {
    logger.error("Failed to read Doula Profile for Outreach", {
      errorId: ERROR_IDS.API_MEMBER_OUTREACH_PROFILE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      slug,
    });
    throw error;
  }
}

export const OutreachServiceImpl: OutreachService = {
  reserveOutreach,
  recordOutreach,
  releaseOutreach,
  sendOutreachEmail,
  findPublishedProfileUrl,
};
