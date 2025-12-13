import type { Context } from "elysia";
import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../collections/index.js";

export async function getMember({
  params,
  set,
}: Context<{ params: Record<"memberId", string> }>) {
  const document = await getFirestore()
    .collection(MEMBERS_COLLECTION)
    .doc(params.memberId)
    .get();

  if (!document.exists) {
    set.status = 404;
    return { error: "Member not found" };
  }

  return { id: document.id, ...document.data() };
}
