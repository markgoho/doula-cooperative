import { activateMembership } from "./activate-membership.js";
import { cancelMembership } from "./cancel-membership.js";
import { cleanSlateDelete } from "./clean-slate-delete.js";
import { extendMembership } from "./extend-membership.js";
import { isAdmin } from "./is-admin.js";
import { listMembers } from "./list-members.js";
import { refundMembership } from "./refund-membership.js";
import { toggleProfileDraft } from "./toggle-profile-draft.js";
import { updateClaims } from "./update-claims.js";
import { updateMember } from "./update-member.js";
import { verifyMemberExists } from "./verify-member-exists.js";

/**
 * Service object for admin member management operations.
 * Exported as a plain object following the pattern from auth-service and member-service.
 */
export const MemberAdminService = {
  verifyMemberExists,
  listMembers,
  updateMember,
  activateMembership,
  cancelMembership,
  extendMembership,
  updateClaims,
  isAdmin,
  refundMembership,
  cleanSlateDelete,
  toggleProfileDraft,
};

// Re-export individual functions for direct imports
export { activateMembership } from "./activate-membership.js";
export { cancelMembership } from "./cancel-membership.js";
export { cleanSlateDelete } from "./clean-slate-delete.js";
export { extendMembership } from "./extend-membership.js";
export { isAdmin } from "./is-admin.js";
export { listMembers } from "./list-members.js";
export { refundMembership } from "./refund-membership.js";
export { toggleProfileDraft } from "./toggle-profile-draft.js";
export { updateClaims } from "./update-claims.js";
export { updateMember } from "./update-member.js";
export { verifyMemberExists } from "./verify-member-exists.js";
