import type { ProfileData } from "../../profiles-api/schemas/profile-schemas.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberDocument } from "../../types/member-document.js";
import type { ApproveProfileResult } from "./approve-profile.js";
import type { CleanSlateResult } from "./clean-slate-delete.js";
import type { DeleteDraftProfileResult } from "./delete-draft-profile.js";
import type { LinkProfileResult } from "./link-profile.js";
import type { ListUnlinkedProfilesResult } from "./list-unlinked-profiles.js";
import type { ReadProfileResult } from "./read-profile.js";
import type { RefundMembershipResult } from "./refund-membership.js";
import type { ToggleProfileDraftResult } from "./toggle-profile-draft.js";
import type { UpdateProfileResult } from "./update-profile.js";

/**
 * Service interface for admin member management operations.
 * Decoupled from HTTP framework and Firebase implementation details.
 */
export interface MemberAdminService {
  /**
   * Verify that a member exists.
   *
   * @param memberId - The Firestore document ID
   * @returns Promise resolving to member document
   * @throws NotFoundError if member does not exist
   */
  verifyMemberExists(memberId: string): Promise<MemberDocument>;

  /**
   * List all members.
   *
   * @param options - Logger for error reporting
   * @returns Promise resolving to members array, total count, and optional warning
   */
  listMembers(options: { logger: Logger }): Promise<{
    members: MemberDocument[];
    total: number;
    warning?: string;
  }>;

  /**
   * Update a member's fields (partial update).
   * Accepts API shape (dates as ISO strings), converts to Firestore shape internally.
   *
   * @param memberId - The Firestore document ID
   * @param updates - Partial member updates with dates as ISO strings
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   * @throws ValidationError if trying to update protected fields
   */
  updateMember(
    memberId: string,
    updates: {
      name?: string;
      email?: string;
      subscriptionStart?: string;
      membershipExpiresAt?: string;
      membershipActive?: boolean;
      slug?: string;
    },
  ): Promise<MemberDocument>;

  /**
   * Activate a membership with optional start and expiration dates.
   *
   * @param memberId - The Firestore document ID
   * @param options - Optional subscription start and expiration dates (ISO 8601)
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   */
  activateMembership(
    memberId: string,
    options?: {
      subscriptionStart?: string;
      membershipExpiresAt?: string;
    },
  ): Promise<MemberDocument>;

  /**
   * Cancel a membership.
   *
   * For Stripe members: schedules subscription cancellation at end of billing period.
   * For legacy members: deactivates immediately.
   *
   * @param memberId - The Firestore document ID
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   * @throws Error if Stripe cancellation fails
   */
  cancelMembership(memberId: string): Promise<MemberDocument>;

  /**
   * Extend a membership expiration date.
   *
   * @param memberId - The Firestore document ID
   * @param newExpirationDate - New expiration date (ISO 8601)
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   * @throws ValidationError if date is invalid
   */
  extendMembership(
    memberId: string,
    newExpirationDate: string,
  ): Promise<MemberDocument>;

  /**
   * Update custom claims for a user.
   * Claims are merged with existing claims. Set a claim to false to remove it.
   *
   * @param options - Object containing user ID, claims to update, requesting admin UID, and logger
   * @returns Promise resolving when claims are updated
   * @throws NotFoundError if user does not exist
   * @throws ForbiddenError if trying to modify own admin claim
   * @throws ValidationError if UID format is invalid
   */
  updateClaims(options: {
    uid: string;
    claims: { admin?: boolean };
    requestingAdminUid: string;
    logger: Logger;
  }): Promise<void>;

  /**
   * Check if a user has admin privileges.
   *
   * @param uid - The user's UID
   * @param logger - Logger for error reporting
   * @returns Promise resolving to true if user has admin claim, false otherwise
   */
  isAdmin(uid: string, logger: Logger): Promise<boolean>;

  /**
   * Refund a member's Stripe payment, cancel subscription, and deactivate membership.
   *
   * @param options - Member ID, optional reason, and email service for notifications
   * @returns Promise resolving to refund result with updated member and action statuses
   * @throws NotFoundError if member does not exist
   * @throws ValidationError if member has no Stripe data
   */
  refundMembership(options: {
    memberId: string;
    reason?: string;
    emailService?: EmailServiceInterface;
  }): Promise<RefundMembershipResult>;

  /**
   * Clean slate delete: remove every trace of a user across all integrated systems.
   * Removes Stripe customer/subscription, MailerLite subscriber, Hugo profile,
   * ImageKit profile image, Firestore member document, and Firebase Auth user.
   *
   * @param options - Member ID, requesting admin UID, and optional email service
   * @returns Promise resolving to clean slate result with status of each cleanup step
   * @throws NotFoundError if member does not exist
   * @throws ForbiddenError if trying to delete self or another admin
   */
  cleanSlateDelete(options: {
    memberId: string;
    requestingAdminUid: string;
    emailService?: EmailServiceInterface;
  }): Promise<CleanSlateResult>;

  /**
   * Toggle the draft status of a member's profile.
   * Reads the current profile, flips `draft`, writes it back, and triggers a Hugo rebuild.
   *
   * @param options - Object containing the member ID
   * @returns Promise resolving to the slug, new draft status, and Hugo rebuild status
   * @throws NotFoundError if member or profile does not exist
   * @throws ValidationError if member has no slug
   */
  toggleProfileDraft(options: {
    memberId: string;
  }): Promise<ToggleProfileDraftResult>;

  /**
   * Delete a member's draft profile while preserving the member account.
   * Removes the Firestore profile, clears member profile fields, and triggers a rebuild.
   *
   * @param options - Object containing member ID and optional email service
   * @returns Promise resolving to deletion statuses
   * @throws NotFoundError if member or profile does not exist
   * @throws ValidationError if member has no slug or profile is not draft
   */
  deleteDraftProfile(options: {
    memberId: string;
    emailService?: EmailServiceInterface;
  }): Promise<DeleteDraftProfileResult>;

  /**
   * Read a member's profile directly from Firestore.
   * Bypasses the public endpoint's draft access control so admins can always view profiles.
   *
   * @param options - Object containing the member ID
   * @returns Promise resolving to the slug and profile data
   * @throws NotFoundError if member or profile does not exist
   * @throws ValidationError if member has no slug
   */
  readProfile(options: { memberId: string }): Promise<ReadProfileResult>;

  /**
   * Update a member's profile directly in Firestore.
   * Bypasses the public endpoint ownership checks so admins can edit any profile.
   *
   * @param options - Object containing the member ID and updated profile data
   * @returns Promise resolving to the slug and updated profile data
   * @throws NotFoundError if member or profile does not exist
   * @throws ValidationError if member has no slug
   */
  updateProfile(options: {
    memberId: string;
    data: ProfileData;
  }): Promise<UpdateProfileResult>;

  /**
   * List all profiles that are not linked to a member account.
   * These are profiles where the `ownerUid` field does not exist.
   *
   * @returns Promise resolving to array of unlinked profiles
   */
  listUnlinkedProfiles(): Promise<ListUnlinkedProfilesResult>;

  /**
   * Approve a member to create or edit a profile.
   *
   * @param options - Object containing memberId
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   */
  approveProfile(options: { memberId: string }): Promise<ApproveProfileResult>;

  /**
   * Link an unlinked profile to a member account.
   * Creates a bidirectional relationship between profile and member.
   *
   * @param options - Object containing memberId and slug
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member or profile does not exist
   * @throws ValidationError if member already has a profile or profile is already linked
   */
  linkProfile(options: {
    memberId: string;
    slug: string;
  }): Promise<LinkProfileResult>;
}
