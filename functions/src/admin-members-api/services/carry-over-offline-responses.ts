import { getFirestore } from "firebase-admin/firestore";
import {
  LEGACY_RESPONSES_SUBCOLLECTION,
  type LegacyResponseDocument,
} from "../../collections/legacy-responses.js";
import {
  MEMBER_RESPONSES_SUBCOLLECTION,
  type MemberResponseDocument,
} from "../../collections/member-responses.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";

export interface CarryOverOfflineResponsesResult {
  /** Legacy Offline Responses moved onto the Member (or dropped as duplicates). */
  carried: number;
}

/**
 * Move a linked Legacy Membership's Offline Responses onto the Member:
 * each `matchRequests/{id}/legacyResponses/{legacyEmail}` becomes
 * `matchRequests/{id}/memberResponses/{memberUid}.offlineResponse`, keeping
 * who recorded it and when.
 *
 * Where the Member already sent Outreach or already has an Offline Response
 * on that Referral, the legacy Offline Response is dropped. A Referral
 * Outcome a Referral Coordinator recorded for the Legacy Membership becomes
 * the Member's `outcome` (with `outcomeUpdatedAt`) either way, but never
 * replaces an Outcome the Member already has. Each move is its own
 * transaction that re-reads both documents, so a retry is a no-op for moves
 * already done.
 *
 * @param options.memberUid - The linked Member's uid
 * @param options.legacyEmail - The Legacy Membership's import document ID, exactly as stored
 * @throws Error when the lookup fails or any move fails (after attempting every move)
 */
export async function carryOverOfflineResponses({
  memberUid,
  legacyEmail,
  logger,
}: {
  memberUid: string;
  legacyEmail: string;
  logger: Logger;
}): Promise<CarryOverOfflineResponsesResult> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collectionGroup(LEGACY_RESPONSES_SUBCOLLECTION)
    .where("legacyEmail", "==", legacyEmail)
    .get();

  const failedRequestIds: string[] = [];
  let carried = 0;

  for (const legacyDocument of snapshot.docs) {
    const referral = legacyDocument.ref.parent.parent;
    if (referral === null) continue;

    const legacyReference = legacyDocument.ref;
    const memberResponseReference = referral
      .collection(MEMBER_RESPONSES_SUBCOLLECTION)
      .doc(memberUid);

    try {
      const wasMoved = await firestore.runTransaction(async transaction => {
        const legacySnapshot = await transaction.get(legacyReference);
        const memberResponseSnapshot = await transaction.get(
          memberResponseReference,
        );
        if (!legacySnapshot.exists) return false;

        const legacy = legacySnapshot.data() as LegacyResponseDocument;
        const memberResponse = memberResponseSnapshot.data() as
          MemberResponseDocument | undefined;
        const hasAlreadyResponded =
          memberResponse?.offlineResponse !== undefined ||
          memberResponse?.outreachSentAt !== undefined;

        // Decided apart from the Offline Response: a Member who already sent
        // Outreach still gets the hire a Coordinator recorded, unless they
        // recorded an Outcome of their own.
        const shouldCarryOutcome =
          legacy.outcome !== undefined && memberResponse?.outcome === undefined;

        if (!hasAlreadyResponded || shouldCarryOutcome) {
          transaction.set(
            memberResponseReference,
            {
              memberUid,
              ...(!hasAlreadyResponded && {
                offlineResponse: {
                  recordedBy: legacy.recordedBy,
                  recordedAt: legacy.recordedAt,
                },
              }),
              ...(shouldCarryOutcome && {
                outcome: legacy.outcome,
                ...(legacy.outcomeUpdatedAt && {
                  outcomeUpdatedAt: legacy.outcomeUpdatedAt,
                }),
              }),
            },
            { merge: true },
          );
        }
        transaction.delete(legacyReference);
        return true;
      });
      if (wasMoved) carried += 1;
    } catch (error) {
      failedRequestIds.push(referral.id);
      // The email is never logged; the Referral and Member identify the record.
      logger.error("Failed to carry an Offline Response over to a Member", {
        errorId:
          ERROR_IDS.API_ADMIN_LINK_PROFILE_OFFLINE_RESPONSES_CARRY_OVER_FAILED,
        requestId: referral.id,
        memberUid,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (failedRequestIds.length > 0) {
    throw new Error(
      `Failed to carry Offline Responses over on Referrals: ${failedRequestIds.join(", ")}`,
    );
  }

  return { carried };
}
