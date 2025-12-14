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
}
