import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  LEGACY_RESPONSES_SUBCOLLECTION,
  type LegacyResponseDocument,
} from "../../../collections/legacy-responses.js";
import { MATCH_REQUESTS_COLLECTION } from "../../../collections/match-requests.js";
import {
  MEMBER_RESPONSES_SUBCOLLECTION,
  type MemberResponseDocument,
} from "../../../collections/member-responses.js";
import { MEMBERS_COLLECTION } from "../../../collections/members.js";
import {
  IMPORT_COLLECTION,
  type UnclaimedProfileDocumentData,
} from "../../../collections/migrated-users-import.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { canRecordReferralOutcome } from "../../access/can-record-referral-outcome.js";
import type {
  LegacyDoula,
  MemberDoula,
  OfflineResponseRecording,
  OfflineResponseService,
} from "./interface.js";

/** Firestore's ALREADY_EXISTS status, raised by `create()` on an existing document. */
const ALREADY_EXISTS = 6;

function referralReference(requestId: string) {
  return getFirestore().collection(MATCH_REQUESTS_COLLECTION).doc(requestId);
}

function logFailure(
  logger: Logger,
  message: string,
  error: unknown,
  context: Record<string, unknown>,
) {
  logger.error(message, {
    errorId: ERROR_IDS.API_MEMBER_OFFLINE_RESPONSE_WRITE_FAILED,
    error,
    errorMessage: error instanceof Error ? error.message : "Unknown error",
    ...context,
  });
}

async function listMemberDoulas(logger: Logger): Promise<MemberDoula[]> {
  try {
    const snapshot = await getFirestore()
      .collection(MEMBERS_COLLECTION)
      .select("name", "email")
      .get();
    return snapshot.docs.map(document => {
      const { name, email } = document.data() as Partial<MemberDocument>;
      return { uid: document.id, name: name?.trim() ?? "", email: email ?? "" };
    });
  } catch (error) {
    logger.error("Failed to list Members for the doula picker", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

async function listUnclaimedLegacyMemberships(
  logger: Logger,
): Promise<LegacyDoula[]> {
  try {
    const snapshot = await getFirestore()
      .collection(IMPORT_COLLECTION)
      .select("name")
      .get();
    return snapshot.docs.map(document => ({
      email: document.id,
      name:
        (
          document.data() as Partial<UnclaimedProfileDocumentData>
        ).name?.trim() ?? "",
    }));
  } catch (error) {
    logger.error("Failed to list Unclaimed Legacy Memberships", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

async function recordMemberOfflineResponse(
  {
    requestId,
    memberUid,
    recordedBy,
    recordedAt,
  }: {
    requestId: string;
    memberUid: string;
    recordedBy: string;
    recordedAt: Date;
  },
  logger: Logger,
): Promise<OfflineResponseRecording> {
  try {
    const reference = referralReference(requestId)
      .collection(MEMBER_RESPONSES_SUBCOLLECTION)
      .doc(memberUid);
    return await getFirestore().runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      const response = snapshot.data() as MemberResponseDocument | undefined;
      if (response?.outreachSentAt) return "has_outreach";
      if (response?.offlineResponse) return "already_recorded";

      transaction.set(
        reference,
        {
          memberUid,
          offlineResponse: {
            recordedBy,
            recordedAt: Timestamp.fromDate(recordedAt),
          },
        },
        { merge: true },
      );
      return "recorded";
    });
  } catch (error) {
    logFailure(logger, "Failed to record a Member's Offline Response", error, {
      requestId,
      memberUid,
    });
    throw error;
  }
}

async function recordLegacyOfflineResponse(
  {
    requestId,
    legacyEmail,
    displayName,
    recordedBy,
    recordedAt,
  }: {
    requestId: string;
    legacyEmail: string;
    displayName: string;
    recordedBy: string;
    recordedAt: Date;
  },
  logger: Logger,
): Promise<Exclude<OfflineResponseRecording, "has_outreach">> {
  const document: LegacyResponseDocument = {
    legacyEmail,
    displayName,
    recordedBy,
    recordedAt: Timestamp.fromDate(recordedAt),
  };
  try {
    await referralReference(requestId)
      .collection(LEGACY_RESPONSES_SUBCOLLECTION)
      .doc(legacyEmail)
      .create(document);
    return "recorded";
  } catch (error) {
    if ((error as { code?: unknown }).code === ALREADY_EXISTS) {
      return "already_recorded";
    }
    // The email is never logged; the Referral is enough to find the record.
    logFailure(
      logger,
      "Failed to record a Legacy Membership's Offline Response",
      error,
      { requestId },
    );
    throw error;
  }
}

async function deleteMemberOfflineResponse(
  { requestId, memberUid }: { requestId: string; memberUid: string },
  logger: Logger,
): Promise<void> {
  try {
    const reference = referralReference(requestId)
      .collection(MEMBER_RESPONSES_SUBCOLLECTION)
      .doc(memberUid);
    await getFirestore().runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      const response = snapshot.data() as MemberResponseDocument | undefined;
      if (!response?.offlineResponse) return;

      const remaining: MemberResponseDocument = { ...response, memberUid };
      delete remaining.offlineResponse;
      transaction.update(reference, {
        offlineResponse: FieldValue.delete(),
        // Nothing unlocks the Outcome any more, so it would be stuck.
        ...(!canRecordReferralOutcome(remaining) && {
          outcome: FieldValue.delete(),
          outcomeUpdatedAt: FieldValue.delete(),
        }),
      });
    });
  } catch (error) {
    logFailure(logger, "Failed to delete a Member's Offline Response", error, {
      requestId,
      memberUid,
    });
    throw error;
  }
}

async function deleteLegacyOfflineResponse(
  { requestId, legacyEmail }: { requestId: string; legacyEmail: string },
  logger: Logger,
): Promise<void> {
  try {
    await referralReference(requestId)
      .collection(LEGACY_RESPONSES_SUBCOLLECTION)
      .doc(legacyEmail)
      .delete();
  } catch (error) {
    logFailure(
      logger,
      "Failed to delete a Legacy Membership's Offline Response",
      error,
      { requestId },
    );
    throw error;
  }
}

export const OfflineResponseServiceImpl: OfflineResponseService = {
  listMemberDoulas,
  listUnclaimedLegacyMemberships,
  recordMemberOfflineResponse,
  recordLegacyOfflineResponse,
  deleteMemberOfflineResponse,
  deleteLegacyOfflineResponse,
};
