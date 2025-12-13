import type { DecodedIdToken } from "firebase-admin/auth";
import type { MemberDocument } from "../../types/member-document.js";

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
