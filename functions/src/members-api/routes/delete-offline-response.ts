import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canDeleteOfflineResponse } from "../access/can-delete-offline-response.js";
import { canRecordOfflineResponses } from "../access/can-record-offline-responses.js";
import type {
  DeleteOfflineResponseResponse,
  ReferralDoulaKind,
} from "../schemas/referral-schemas.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
import type { OfflineResponseService } from "../services/offline-response/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

interface ErrorBody {
  error: string;
  code?: string;
}

const DELETE_ERRORS = {
  coordinatorRequired: {
    error: "Only the Referral Coordinator can delete Offline Responses",
    code: "REFERRAL_COORDINATOR_REQUIRED",
  },
  notFound: {
    error: "That Offline Response was already deleted",
    code: "OFFLINE_RESPONSE_NOT_FOUND",
  },
  notYours: {
    error: "You can only delete Offline Responses you recorded",
    code: "OFFLINE_RESPONSE_NOT_YOURS",
  },
} satisfies Record<string, ErrorBody>;

/**
 * Delete an Offline Response. A Referral Coordinator deletes the ones she
 * recorded; one who is also an Admin may delete any. Deleting a Member's
 * Offline Response also clears their Referral Outcome when they never sent
 * Outreach, since nothing unlocks it any more.
 */
export async function deleteOfflineResponseLogic({
  memberId,
  requestId,
  kind,
  id,
  referralsService,
  offlineResponseService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  requestId: string;
  kind: ReferralDoulaKind;
  /** A Member's uid, or a Legacy Membership's opaque id. */
  id: string;
  referralsService: ReferralsService;
  offlineResponseService: OfflineResponseService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<DeleteOfflineResponseResponse | ErrorBody> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );
    if (
      decodedToken.uid !== memberId ||
      !canRecordOfflineResponses(decodedToken)
    ) {
      set.status = 403;
      return DELETE_ERRORS.coordinatorRequired;
    }

    // 404 when the Referral doesn't exist.
    await referralsService.getReferral(requestId, logger);

    const found =
      kind === "member"
        ? await findMemberOfflineResponse({
            requestId,
            id,
            referralsService,
            offlineResponseService,
            logger,
          })
        : await findLegacyOfflineResponse({
            requestId,
            id,
            referralsService,
            offlineResponseService,
            logger,
          });

    if (found === undefined) {
      set.status = 404;
      return DELETE_ERRORS.notFound;
    }
    if (!canDeleteOfflineResponse(decodedToken, found.recordedBy)) {
      set.status = 403;
      return DELETE_ERRORS.notYours;
    }

    await found.remove();
    return { deleted: true };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to delete Offline Response", {
      errorId: ERROR_IDS.API_MEMBER_DELETE_OFFLINE_RESPONSE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
      requestId,
      kind,
    });

    set.status = 500;
    return {
      error: "Failed to delete the Offline Response. Please try again.",
    };
  }
}

interface FindContext {
  requestId: string;
  id: string;
  referralsService: ReferralsService;
  offlineResponseService: OfflineResponseService;
  logger: Logger;
}

/** Who recorded the Offline Response, and how to remove it; undefined when none. */
type Found = { recordedBy: string; remove: () => Promise<void> } | undefined;

async function findMemberOfflineResponse({
  requestId,
  id,
  referralsService,
  offlineResponseService,
  logger,
}: FindContext): Promise<Found> {
  const responses = await referralsService.listMemberResponses(
    requestId,
    logger,
  );
  const offline = responses.find(
    response => response.memberUid === id,
  )?.offlineResponse;
  if (!offline) return undefined;
  return {
    recordedBy: offline.recordedBy,
    remove: () =>
      offlineResponseService.deleteMemberOfflineResponse(
        { requestId, memberUid: id },
        logger,
      ),
  };
}

async function findLegacyOfflineResponse({
  requestId,
  id,
  referralsService,
  offlineResponseService,
  logger,
}: FindContext): Promise<Found> {
  // Resolved against the Referral's own records, so it still works after the
  // Legacy Membership's import document is gone.
  const responses = await referralsService.listLegacyResponses(
    requestId,
    logger,
  );
  const offline = responses.find(
    ({ legacyEmail }) => toLegacyDoulaId(legacyEmail) === id,
  );
  if (!offline) return undefined;
  return {
    recordedBy: offline.recordedBy,
    remove: () =>
      offlineResponseService.deleteLegacyOfflineResponse(
        { requestId, legacyEmail: offline.legacyEmail },
        logger,
      ),
  };
}
