import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/members.js";
import type { MemberDocument } from "../../../types/member-document.js";

/**
 * Look up several Members' names in one batch read.
 *
 * @param memberIds - Firestore document IDs (duplicates are read once)
 * @returns Name by member ID; a missing member or unset name is absent
 */
export async function findMemberNamesByIds(
  memberIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(memberIds)];
  if (uniqueIds.length === 0) return names;

  const firestore = getFirestore();
  const snapshots = await firestore.getAll(
    ...uniqueIds.map(memberId =>
      firestore.collection(MEMBERS_COLLECTION).doc(memberId),
    ),
  );
  for (const snapshot of snapshots) {
    const name = (snapshot.data() as MemberDocument | undefined)?.name?.trim();
    if (name) names.set(snapshot.id, name);
  }
  return names;
}
