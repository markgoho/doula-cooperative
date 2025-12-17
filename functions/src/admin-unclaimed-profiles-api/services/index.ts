import { getUnclaimedProfile } from "./get-unclaimed-profile.js";
import { listUnclaimedProfiles } from "./list-unclaimed-profiles.js";
import { sendInvitation } from "./send-invitation.js";

/**
 * Service object for admin unclaimed profile management operations.
 * Exported as a plain object following the pattern from admin-members-api.
 */
export const UnclaimedProfileAdminService = {
  listUnclaimedProfiles,
  getUnclaimedProfile,
  sendInvitation,
};

// Re-export individual functions for direct imports
export { getUnclaimedProfile } from "./get-unclaimed-profile.js";
export { listUnclaimedProfiles } from "./list-unclaimed-profiles.js";
export { sendInvitation } from "./send-invitation.js";
