import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberDocument } from "../../types/member-document.js";

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
   * Deactivate a membership.
   *
   * @param memberId - The Firestore document ID
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   */
  deactivateMembership(memberId: string): Promise<MemberDocument>;

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
   * Delete a user's Auth account and trigger member document cleanup.
   *
   * @param memberId - The Firestore document ID / Auth UID
   * @param requestingAdminUid - The UID of the admin making the request
   * @returns Promise resolving when deletion is complete
   * @throws NotFoundError if user does not exist
   * @throws ForbiddenError if trying to delete self or another admin
   */
  deleteUser(memberId: string, requestingAdminUid: string): Promise<void>;

  /**
   * Update custom claims for a user.
   * Claims are merged with existing claims. Set a claim to false to remove it.
   *
   * @param options - Object containing user ID, claims to update, and requesting admin UID
   * @returns Promise resolving when claims are updated
   * @throws NotFoundError if user does not exist
   * @throws ForbiddenError if trying to modify own admin claim
   * @throws ValidationError if UID format is invalid
   */
  updateClaims(options: {
    uid: string;
    claims: { admin?: boolean };
    requestingAdminUid: string;
  }): Promise<void>;
}
