import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canRecordOfflineResponses } from "../access/can-record-offline-responses.js";
import type {
  RecordOfflineResponseResponse,
  ReferralDoulaKind,
} from "../schemas/referral-schemas.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
import { toOfflineResponseRow } from "../schemas/to-offline-response-row.js";
import type { MemberService } from "../services/member/interface.js";
import type {
  OfflineResponseRecording,
  OfflineResponseService,
} from "../services/offline-response/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";

interface ErrorBody {
  error: string;
  code?: string;
}

const OFFLINE_RESPONSE_ERRORS = {
  coordinatorRequired: {
    error: "Only the Referral Coordinator can record Offline Responses",
    code: "REFERRAL_COORDINATOR_REQUIRED",
  },
  doulaNotFound: {
    error: "That doula isn't in the list any more. Reload and try again.",
    code: "DOULA_NOT_FOUND",
  },
} satisfies Record<string, ErrorBody>;

const RECORDING_CONFLICTS: Record<
  Exclude<OfflineResponseRecording, "recorded">,
  ErrorBody
> = {
  has_outreach: {
    error: "This member already sent Outreach on this referral",
    code: "OFFLINE_RESPONSE_HAS_OUTREACH",
  },
  already_recorded: {
    error: "An Offline Response is already recorded for this doula",
    code: "OFFLINE_RESPONSE_ALREADY_RECORDED",
  },
};

/**
 * Record that a doula (a Member or an Unclaimed Legacy Membership) responded
 * to a Referral outside the member portal. Referral Coordinators only, on
 * their own path. At most one per doula per Referral, and never for a Member
 * who already sent Outreach on it.
 */
export async function recordOfflineResponseLogic({
  memberId,
  requestId,
  kind,
  id,
  memberService,
  referralsService,
  offlineResponseService,
  authService,
  logger,
  authorizationHeader,
  set,
  now = () => new Date(),
}: {
  memberId: string;
  requestId: string;
  kind: ReferralDoulaKind;
  /** A Member's uid, or a Legacy Membership's opaque id. */
  id: string;
  memberService: MemberService;
  referralsService: ReferralsService;
  offlineResponseService: OfflineResponseService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
  now?: () => Date;
}): Promise<RecordOfflineResponseResponse | ErrorBody> {
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
      return OFFLINE_RESPONSE_ERRORS.coordinatorRequired;
    }

    // 404 when the Referral doesn't exist. No window: she sees every Referral.
    await referralsService.getReferral(requestId, logger);

    const recordedAt = now();
    const record = { requestId, recordedBy: decodedToken.uid, recordedAt };
    const recorded =
      kind === "member"
        ? await recordForMember({
            id,
            record,
            memberService,
            offlineResponseService,
            logger,
          })
        : await recordForLegacy({
            id,
            record,
            offlineResponseService,
            logger,
          });

    if (recorded === undefined) {
      set.status = 404;
      return OFFLINE_RESPONSE_ERRORS.doulaNotFound;
    }
    if (recorded.result !== "recorded") {
      set.status = 409;
      return RECORDING_CONFLICTS[recorded.result];
    }

    set.status = 201;
    return {
      offlineResponse: await toRow({
        kind,
        id,
        displayName: recorded.displayName,
        recordedAt,
        decodedToken,
        memberService,
      }),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to record Offline Response", {
      errorId: ERROR_IDS.API_MEMBER_RECORD_OFFLINE_RESPONSE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
      requestId,
      kind,
    });

    set.status = 500;
    return { error: "Failed to save the Offline Response. Please try again." };
  }
}

interface RecordContext {
  id: string;
  record: { requestId: string; recordedBy: string; recordedAt: Date };
  offlineResponseService: OfflineResponseService;
  logger: Logger;
}

/** Undefined when no such doula exists. */
type Recorded =
  { result: OfflineResponseRecording; displayName: string } | undefined;

async function recordForMember({
  id,
  record,
  memberService,
  offlineResponseService,
  logger,
}: RecordContext & { memberService: MemberService }): Promise<Recorded> {
  // findById throws NotFoundError (404) for an unknown uid.
  const member = await memberService.findById(id);
  const result = await offlineResponseService.recordMemberOfflineResponse(
    { ...record, memberUid: id },
    logger,
  );
  return { result, displayName: member.name?.trim() ?? "" };
}

async function recordForLegacy({
  id,
  record,
  offlineResponseService,
  logger,
}: RecordContext): Promise<Recorded> {
  const legacy =
    await offlineResponseService.listUnclaimedLegacyMemberships(logger);
  const match = legacy.find(({ email }) => toLegacyDoulaId(email) === id);
  if (!match) return undefined;
  const result = await offlineResponseService.recordLegacyOfflineResponse(
    { ...record, legacyEmail: match.email, displayName: match.name },
    logger,
  );
  return { result, displayName: match.name };
}

async function toRow({
  kind,
  id,
  displayName,
  recordedAt,
  decodedToken,
  memberService,
}: {
  kind: ReferralDoulaKind;
  id: string;
  displayName: string;
  recordedAt: Date;
  decodedToken: DecodedIdToken;
  memberService: MemberService;
}) {
  const names = await memberService.findNamesByIds([decodedToken.uid]);
  return toOfflineResponseRow({
    kind,
    id,
    displayName,
    recordedBy: decodedToken.uid,
    recordedAt: Timestamp.fromDate(recordedAt),
    names,
    decodedToken,
  });
}
