import { attachImportedProfile } from "./attach-imported-profile.js";
import { changeEmailAndResend } from "./change-email-and-resend.js";
import { deleteUnclaimedProfile } from "./delete-unclaimed-profile.js";
import { getUnclaimedProfile } from "./get-unclaimed-profile.js";
import { listUnclaimedProfiles } from "./list-unclaimed-profiles.js";
import { refreshPaymentDates } from "./refresh-payment-dates.js";
import { sendInvitation } from "./send-invitation.js";
import { updateEmail } from "./update-email.js";

/**
 * Service object for admin unclaimed profile management operations.
 * Exported as a plain object following the pattern from admin-members-api.
 */
export const UnclaimedProfileAdminService = {
  listUnclaimedProfiles,
  getUnclaimedProfile,
  sendInvitation,
  changeEmailAndResend,
  updateEmail,
  deleteUnclaimedProfile,
  refreshPaymentDates,
  attachImportedProfile,
};

// Re-export individual functions for direct imports
export { attachImportedProfile } from "./attach-imported-profile.js";
export { changeEmailAndResend } from "./change-email-and-resend.js";
export { deleteUnclaimedProfile } from "./delete-unclaimed-profile.js";
export { getUnclaimedProfile } from "./get-unclaimed-profile.js";
export { listUnclaimedProfiles } from "./list-unclaimed-profiles.js";
export { refreshPaymentDates } from "./refresh-payment-dates.js";
export { sendInvitation } from "./send-invitation.js";
export { updateEmail } from "./update-email.js";
