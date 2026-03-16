import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import type {
  ListMatchRequestsResponse,
  MatchRequestResponse,
} from "../schemas/match-request-schemas.js";
import type { MatchRequestStatus } from "./list-match-requests.js";

export interface MatchRequestAdminService {
  listMatchRequests(options: {
    limit?: number;
    offset?: number;
    status?: MatchRequestStatus;
    logger: Logger;
  }): Promise<ListMatchRequestsResponse>;

  getMatchRequest(options: {
    requestId: string;
    logger: Logger;
  }): Promise<MatchRequestResponse>;

  updateMatchRequest(options: {
    requestId: string;
    sent: boolean;
    logger: Logger;
  }): Promise<{ success: true }>;
}
