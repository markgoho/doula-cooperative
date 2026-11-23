import { getFirestore } from "firebase-admin/firestore";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../../collections/members.js";

const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

export async function listMembersWithLiveSubscription(): Promise<
  MemberDocument[]
> {
  const snapshot = await getFirestore()
    .collection(MEMBERS_COLLECTION)
    .where("subscriptionStatus", "in", LIVE_SUBSCRIPTION_STATUSES)
    .get();

  return snapshot.docs.map(document => document.data() as MemberDocument);
}
