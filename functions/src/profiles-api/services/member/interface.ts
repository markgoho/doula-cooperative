import type { MemberDocument } from "../../../collections/index.js";

/**
 * Response from checking slug availability.
 */
export interface SlugAvailabilityResponse {
  available: boolean;
}

/**
 * Response from setting a profile slug.
 */
export interface SetSlugResponse {
  slug: string;
}

/**
 * Service interface for member-related profile operations.
 * Handles Firestore interactions for member documents.
 */
export interface ProfileMemberService {
  /**
   * Get a member document by user ID.
   *
   * @param uid - Firebase Auth user ID
   * @returns Promise with member document
   * @throws NotFoundError if member not found
   */
  getMemberByUid(uid: string): Promise<MemberDocument>;

  /**
   * Verify user has an active membership and return the member document.
   *
   * @param uid - Firebase Auth user ID
   * @returns Promise with member document
   * @throws NotFoundError if member not found
   * @throws ForbiddenError if membership not active
   */
  verifyActiveMembership(uid: string): Promise<MemberDocument>;

  /**
   * Check if a slug is available (not already in use).
   *
   * @param slug - The slug to check
   * @param excludeUid - Optional user ID to exclude (for the user's own slug)
   * @returns Promise with availability status
   */
  checkSlugAvailable(
    slug: string,
    excludeUid?: string,
  ): Promise<SlugAvailabilityResponse>;

  /**
   * Set the profile slug for a user.
   *
   * @param options.uid - Firebase Auth user ID
   * @param options.slug - The slug to set
   * @returns Promise with the set slug
   * @throws ValidationError if slug is invalid
   * @throws ConflictError if slug is already taken
   */
  setSlug(options: { uid: string; slug: string }): Promise<SetSlugResponse>;

  /**
   * Mark profile as created by setting profileCreatedAt timestamp.
   *
   * @param uid - Firebase Auth user ID
   */
  setProfileCreatedAt(uid: string): Promise<void>;
}
