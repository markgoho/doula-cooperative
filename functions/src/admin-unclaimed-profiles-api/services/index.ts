import { deleteUnclaimedProfile } from "./delete-unclaimed-profile.js";
import { draftUnclaimedProfile } from "./draft-unclaimed-profile.js";
import { getUnclaimedProfile } from "./get-unclaimed-profile.js";
import { listUnclaimedProfiles } from "./list-unclaimed-profiles.js";
import { refreshPaymentDates } from "./refresh-payment-dates.js";
import { updateEmail } from "./update-email.js";

/**
 * Service object for admin unclaimed profile management operations.
 * Exported as a plain object following the pattern from admin-members-api.
 */
export const UnclaimedProfileAdminService = {
  listUnclaimedProfiles,
  getUnclaimedProfile,
  updateEmail,
  deleteUnclaimedProfile,
  draftUnclaimedProfile,
  refreshPaymentDates,
};

// Re-export individual functions for direct imports
export { deleteUnclaimedProfile } from "./delete-unclaimed-profile.js";
export { draftUnclaimedProfile } from "./draft-unclaimed-profile.js";
export { getUnclaimedProfile } from "./get-unclaimed-profile.js";
export { listUnclaimedProfiles } from "./list-unclaimed-profiles.js";
export { refreshPaymentDates } from "./refresh-payment-dates.js";
export { updateEmail } from "./update-email.js";
