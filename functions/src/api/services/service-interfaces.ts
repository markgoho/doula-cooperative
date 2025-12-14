import type { DecodedIdToken } from "firebase-admin/auth";
import type { MemberDocument } from "../../types/member-document.js";
import type { Logger } from "../handler.js";

/**
 * Service interface for member-related operations.
 * Decoupled from HTTP framework and Firebase implementation details.
 */
export interface MemberService {
  /**
   * Find a member by their Firestore document ID.
   *
   * @param memberId - The Firestore document ID
   * @returns Promise resolving to member document
   * @throws NotFoundError if member does not exist
   */
  findById(memberId: string): Promise<MemberDocument>;
}

/**
 * Service interface for authentication and authorization operations.
 * Decoupled from HTTP framework and Firebase implementation details.
 */
export interface AuthService {
  /**
   * Extract and verify Firebase Auth token from Authorization header.
   *
   * @param authHeader - The Authorization header value (e.g., "Bearer token123")
   * @returns Promise resolving to decoded Firebase token
   * @throws AuthError if token is missing, invalid, or expired
   */
  verifyAuthToken(authHeader: string | undefined): Promise<DecodedIdToken>;

  /**
   * Verify that the authenticated user has admin privileges.
   *
   * @param authHeader - The Authorization header value
   * @returns Promise resolving to decoded token if user is admin
   * @throws AuthError if not authenticated
   * @throws ForbiddenError if not an admin
   */
  verifyAdmin(authHeader: string | undefined): Promise<DecodedIdToken>;

  /**
   * Verify that the authenticated user is either an admin or accessing their own data.
   *
   * @param authHeader - The Authorization header value
   * @param resourceUid - The UID of the resource being accessed
   * @returns Promise resolving to decoded token if access is allowed
   * @throws AuthError if not authenticated
   * @throws ForbiddenError if not authorized
   */
  verifyOwnerOrAdmin(
    authHeader: string | undefined,
    resourceUid: string,
  ): Promise<DecodedIdToken>;
}

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
   * List all members with pagination.
   *
   * @param options - Pagination options (limit, offset)
   * @returns Promise resolving to members array and total count
   */
  listMembers(options: {
    limit?: number;
    offset?: number;
    logger: Logger;
  }): Promise<{
    members: MemberDocument[];
    total: number;
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
}
