import { NotFoundError } from "../../../shared-api/errors/http-error.js";
import { MemberFirestoreService } from "../../../shared-api/services/member-firestore/index.js";
import type { MemberDocument } from "../../../types/member-document.js";
import type { MemberService as MemberServiceInterface } from "./interface.js";

/**
 * Service for member-related operations.
 * Uses plain object with functions to avoid request dependencies.
 */
export const MemberService: MemberServiceInterface = {
  /**
   * Find a member by their ID.
   *
   * @param memberId - The Firestore document ID of the member
   * @returns Member document data
   * @throws NotFoundError if member does not exist
   */
  async findById(memberId: string): Promise<MemberDocument> {
    const document = await MemberFirestoreService.getMemberByUid(memberId);

    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    return document.data() as MemberDocument;
  },

  /**
   * Update a member's name.
   *
   * @param memberId - The Firestore document ID of the member
   * @param name - The new name to set
   * @returns Updated member document data
   * @throws NotFoundError if member does not exist
   */
  async updateName(memberId: string, name: string): Promise<MemberDocument> {
    const document = await MemberFirestoreService.getMemberByUid(memberId);

    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    await MemberFirestoreService.updateMember(memberId, { name });

    // Re-read the updated document
    const updatedDocument =
      await MemberFirestoreService.getMemberByUid(memberId);
    return updatedDocument.data() as MemberDocument;
  },
};
