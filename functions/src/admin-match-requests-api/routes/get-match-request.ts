import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { MatchRequestDetailResponse } from "../schemas/match-request-schemas.js";
import { toMatchRequestResponses } from "../schemas/to-match-request-responses.js";
import type { MatchRequestAdminService } from "../services/interface.js";

export async function getMatchRequestLogic({
  requestId,
  adminUid,
  matchRequestAdminService,
  logger,
  set,
}: {
  requestId: string;
  adminUid: string;
  matchRequestAdminService: MatchRequestAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MatchRequestDetailResponse | { error: string }> {
  try {
    const [matchRequest, responses, legacyResponses] = await Promise.all([
      matchRequestAdminService.getMatchRequest({ requestId, logger }),
      matchRequestAdminService.listMemberResponses({ requestId }),
      matchRequestAdminService.listLegacyResponses({ requestId }),
    ]);

    // Doulas who responded, plus whoever recorded an Offline Response.
    const names = await matchRequestAdminService.findMemberNamesByIds([
      ...responses
        .filter(
          ({ outreachSentAt, offlineResponse }) =>
            outreachSentAt !== undefined || offlineResponse !== undefined,
        )
        .map(({ memberUid }) => memberUid),
      ...responses.flatMap(({ offlineResponse }) =>
        offlineResponse ? [offlineResponse.recordedBy] : [],
      ),
      ...legacyResponses.map(({ recordedBy }) => recordedBy),
    ]);

    logger.info("Admin retrieved match request", { adminUid, requestId });

    return {
      ...matchRequest,
      responses: toMatchRequestResponses({ responses, legacyResponses, names }),
    };
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get match request",
      errorId: ERROR_IDS.API_ADMIN_GET_MATCH_REQUEST_FAILED,
      logger,
      set,
    });
  }
}
