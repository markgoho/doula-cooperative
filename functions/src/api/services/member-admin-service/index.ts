import { activateMembership } from "./activate-membership.js";
import { deactivateMembership } from "./deactivate-membership.js";
import { deleteUser } from "./delete-user.js";
import { extendMembership } from "./extend-membership.js";
import { listMembers } from "./list-members.js";
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
  deactivateMembership,
  extendMembership,
  deleteUser,
};

// Re-export individual functions for direct imports
export { activateMembership } from "./activate-membership.js";
export { deactivateMembership } from "./deactivate-membership.js";
export { deleteUser } from "./delete-user.js";
export { extendMembership } from "./extend-membership.js";
export { listMembers } from "./list-members.js";
export { updateMember } from "./update-member.js";
export { verifyMemberExists } from "./verify-member-exists.js";
