import { getMatchRequest } from "./get-match-request.js";
import { listMatchRequests } from "./list-match-requests.js";
import { updateMatchRequest } from "./update-match-request.js";

/**
 * Service object for admin match request management operations.
 * Exported as a plain object following the pattern from admin-members-api.
 */
export const MatchRequestAdminService = {
  listMatchRequests,
  getMatchRequest,
  updateMatchRequest,
};

// Re-export individual functions for direct imports
export { getMatchRequest } from "./get-match-request.js";
export { listMatchRequests } from "./list-match-requests.js";
export { updateMatchRequest } from "./update-match-request.js";
