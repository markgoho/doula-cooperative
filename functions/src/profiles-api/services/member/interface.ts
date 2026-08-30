import type { MemberDocument } from "../../../collections/index.js";

/**
 * Response from checking slug availability.
 */
export interface SlugAvailabilityResponse {
  available: boolean;
  /**
   * Present when the slug is taken by a profile with no owner (e.g. a
   * legacy profile imported from Hugo content). Lets the caller offer an
   * "is this you?" prompt instead of silently deduplicating the slug.
   */
  unownedMatch?: { slug: string; title: string };
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
   * Verify user can create or edit a profile.
   *
   * @param uid - Firebase Auth user ID
   * @returns Promise with member document
   * @throws NotFoundError if member not found
   * @throws ForbiddenError if membership not active
   */
  verifyProfileApproved(uid: string): Promise<MemberDocument>;

  /**
   * Check if a slug is available (not already in use as a profile document ID).
   *
   * @param slug - The slug to check
   * @returns Promise with availability status
   */
  checkSlugAvailable(slug: string): Promise<SlugAvailabilityResponse>;

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

  /**
   * Get a member document by slug.
   *
   * @param slug - Profile slug
   * @returns Promise with member document or undefined if not found
   */
  getMemberBySlug(slug: string): Promise<MemberDocument | undefined>;
}
