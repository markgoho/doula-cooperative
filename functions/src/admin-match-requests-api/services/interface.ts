import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import type { Logger } from "../../shared-api/types/logger.js";
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

  listMemberResponses(options: {
    requestId: string;
  }): Promise<MemberResponseDocument[]>;

  listLegacyResponses(options: {
    requestId: string;
  }): Promise<LegacyResponseDocument[]>;

  findMemberNamesByIds(memberIds: string[]): Promise<Map<string, string>>;

  updateMatchRequest(options: {
    requestId: string;
    sent: boolean;
    logger: Logger;
  }): Promise<{ success: true }>;
}
