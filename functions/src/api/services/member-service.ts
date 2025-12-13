import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import { NotFoundError } from "../errors/http-error.js";

/**
 * Service for member-related operations.
 * Uses plain object with functions to avoid request dependencies.
 */
export const MemberService = {
  /**
   * Find a member by their ID.
   *
   * @param memberId - The Firestore document ID of the member
   * @returns Member document data with id
   * @throws NotFoundError if member does not exist
   */
  async findById(memberId: string) {
    const database = getFirestore();
    const document = await database
      .collection(MEMBERS_COLLECTION)
      .doc(memberId)
      .get();

    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    return { id: document.id, ...document.data() };
  },
};
