import type { MemberDocument } from "@doula-coop/functions-shared/collections/index.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Factory function to create a new member document for a user who just signed up.
 * This creates a basic member with no active membership.
 *
 * @param uid - Firebase Auth UID
 * @param email - User's email address
 * @param name - Optional display name
 * @returns A valid MemberDocument with membershipActive: false
 */
export function createNewMemberDocument(
  uid: string,
  email: string,
  name?: string,
): MemberDocument {
  const document: MemberDocument = {
    uid,
    email,
    createdAt: Timestamp.now(),
    membershipActive: false,
  };

  if (name) {
    document.name = name;
  }

  return document;
}
