import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { canRecordOfflineResponses } from "../access/can-record-offline-responses.js";
import type {
  ListReferralDoulasResponse,
  ReferralDoula,
} from "../schemas/referral-schemas.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
import type { OfflineResponseService } from "../services/offline-response/interface.js";

interface ErrorBody {
  error: string;
  code?: string;
}

const COORDINATOR_REQUIRED = {
  error: "Only the Referral Coordinator can record Offline Responses",
  code: "REFERRAL_COORDINATOR_REQUIRED",
};

/**
 * The doulas a Referral Coordinator can name in an Offline Response: every
 * Member (any membership state) and every Unclaimed Legacy Membership, sorted
 * by name. Display name and id only; a Legacy Membership's email never leaves
 * the server.
 *
 * A Legacy Membership whose email belongs to a Member is left out: the doula
 * is already a Member, and one doula should be named once. Doulas with no
 * name set are left out too, since there is nothing to pick them by.
 */
export async function listReferralDoulasLogic({
  memberId,
  offlineResponseService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  offlineResponseService: OfflineResponseService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<ListReferralDoulasResponse | ErrorBody> {
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
      return COORDINATOR_REQUIRED;
    }

    const [members, legacy] = await Promise.all([
      offlineResponseService.listMemberDoulas(logger),
      offlineResponseService.listUnclaimedLegacyMemberships(logger),
    ]);
    const memberEmails = new Set(
      members.map(member => member.email.trim().toLowerCase()),
    );

    const doulas: ReferralDoula[] = [
      ...members
        .filter(({ name }) => name !== "")
        .map(({ uid, name }) => ({
          kind: "member" as const,
          id: uid,
          displayName: name,
        })),
      ...legacy
        .filter(
          ({ email, name }) =>
            name !== "" && !memberEmails.has(email.trim().toLowerCase()),
        )
        .map(({ email, name }) => ({
          kind: "legacy" as const,
          id: toLegacyDoulaId(email),
          displayName: name,
        })),
    ];

    return {
      doulas: doulas.toSorted((a, b) =>
        a.displayName.localeCompare(b.displayName, "en", {
          sensitivity: "base",
        }),
      ),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to list doulas for Offline Responses", {
      errorId: ERROR_IDS.API_MEMBER_LIST_REFERRAL_DOULAS_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
    });

    set.status = 500;
    return { error: "Failed to load the doula list. Please try again." };
  }
}
