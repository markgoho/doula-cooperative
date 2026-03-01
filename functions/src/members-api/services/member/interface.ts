import type { MemberDocument } from "../../../types/member-document.js";

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

  /**
   * Update a member's name.
   *
   * @param memberId - The Firestore document ID
   * @param name - The new name to set
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   * @throws Error for Firestore operation failures
   */
  updateName(memberId: string, name: string): Promise<MemberDocument>;

  /**
   * Cancel a membership by scheduling Stripe subscription cancellation at period end.
   * Only available for members with Stripe subscription data.
   *
   * @param memberId - The Firestore document ID
   * @returns Promise resolving to updated member document
   * @throws NotFoundError if member does not exist
   * @throws ValidationError if member has no Stripe data
   * @throws Error if Stripe cancellation fails
   */
  cancelMembership(memberId: string): Promise<MemberDocument>;
}
