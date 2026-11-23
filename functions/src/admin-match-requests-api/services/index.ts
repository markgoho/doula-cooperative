import { findMemberNamesByIds } from "../../shared-api/services/member-names/find-member-names-by-ids.js";
import { getMatchRequest } from "./get-match-request.js";
import type { MatchRequestAdminService as MatchRequestAdminServiceInterface } from "./interface.js";
import { listLegacyResponses } from "./list-legacy-responses.js";
import { listMatchRequests } from "./list-match-requests.js";
import { listMemberResponses } from "./list-member-responses.js";
import { updateMatchRequest } from "./update-match-request.js";

/**
 * Service object for admin match request management operations.
 * Exported as a plain object following the pattern from admin-members-api.
 */
export const MatchRequestAdminService: MatchRequestAdminServiceInterface = {
  listMatchRequests,
  getMatchRequest,
  listMemberResponses,
  listLegacyResponses,
  findMemberNamesByIds,
  updateMatchRequest,
};

// Re-export individual functions for direct imports
export { getMatchRequest } from "./get-match-request.js";
export { listMatchRequests } from "./list-match-requests.js";
export { updateMatchRequest } from "./update-match-request.js";
