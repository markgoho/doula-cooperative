import type { DocumentSnapshot } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import type { MemberDocument } from "../../../types/member-document.js";
import type { MemberFirestoreService as MemberFirestoreServiceInterface } from "./interface.js";

/**
 * Get a member document by user ID.
 */
async function getMemberByUidImpl(uid: string): Promise<DocumentSnapshot> {
  const database = getFirestore();
  return database.collection(MEMBERS_COLLECTION).doc(uid).get();
}

/**
 * Check if a member document exists.
 */
async function memberExistsImpl(uid: string): Promise<boolean> {
  const database = getFirestore();
  const document = await database.collection(MEMBERS_COLLECTION).doc(uid).get();
  return document.exists;
}

/**
 * Write or merge member document data.
 */
async function writeMemberImpl(
  uid: string,
  data: Partial<MemberDocument>,
): Promise<void> {
  const database = getFirestore();
  await database.collection(MEMBERS_COLLECTION).doc(uid).set(data, {
    merge: true,
  });
}

/**
 * Update specific fields in a member document.
 */
async function updateMemberImpl(
  uid: string,
  data: Partial<MemberDocument>,
): Promise<void> {
  const database = getFirestore();
  await database.collection(MEMBERS_COLLECTION).doc(uid).update(data);
}

/**
 * Delete a member document.
 */
async function deleteMemberImpl(uid: string): Promise<void> {
  const database = getFirestore();
  await database.collection(MEMBERS_COLLECTION).doc(uid).delete();
}

export const MemberFirestoreService: MemberFirestoreServiceInterface = {
  getMemberByUid: getMemberByUidImpl,
  memberExists: memberExistsImpl,
  writeMember: writeMemberImpl,
  updateMember: updateMemberImpl,
  deleteMember: deleteMemberImpl,
};
