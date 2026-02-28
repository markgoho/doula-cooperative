import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import type { MemberDocument } from "../../types/member-document.js";
import {
  handleFirestoreError,
  validateDocumentData,
  validateRequiredFields,
} from "./firestore-error-handler.js";

/**
 * Valid member operations for error messages and logging.
 * Constrains operation strings to prevent typos and ensure consistency.
 */
export type MemberOperation =
  | "activate membership"
  | "deactivate membership"
  | "extend membership"
  | "refund membership"
  | "update member";

/**
 * Common pattern for retrieving and validating a member document after an update.
 *
 * @param memberId - The Firestore document ID
 * @returns Promise resolving to validated member document
 */
export async function retrieveAndValidateMember({
  memberId,
}: {
  memberId: string;
}): Promise<MemberDocument> {
  const firestore = getFirestore();
  const memberReference = firestore
    .collection(MEMBERS_COLLECTION)
    .doc(memberId);

  const memberDocument = await memberReference.get();
  const data = validateDocumentData<MemberDocument>(
    memberDocument as unknown as {
      exists: boolean;
      data: () => MemberDocument | undefined;
      id: string;
    },
    "Member",
    memberId,
  );

  validateRequiredFields(
    data as unknown as Record<string, unknown>,
    ["email", "createdAt"],
    "Member",
    memberId,
  );

  return {
    ...data,
    uid: memberDocument.id,
  };
}

/**
 * Common pattern for updating a member document with error handling.
 *
 * @param memberId - The Firestore document ID
 * @param updates - Partial member updates
 * @param operation - Description of the operation for error messages
 * @returns Promise resolving to updated member document
 */
export async function updateMemberWithValidation({
  memberId,
  updates,
  operation,
}: {
  memberId: string;
  updates: Partial<MemberDocument>;
  operation: MemberOperation;
}): Promise<MemberDocument> {
  const firestore = getFirestore();
  const memberReference = firestore
    .collection(MEMBERS_COLLECTION)
    .doc(memberId);

  try {
    await memberReference.update(updates);
  } catch (error) {
    handleFirestoreError(error, operation, memberId);
  }

  return retrieveAndValidateMember({ memberId });
}
