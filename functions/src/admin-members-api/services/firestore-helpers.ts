import { getFirestore } from "firebase-admin/firestore";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../../collections/index.js";

/**
 * Get a member document reference from Firestore
 */
export async function getMemberDocument({
  firestore,
  uid,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
}) {
  return firestore.collection(MEMBERS_COLLECTION).doc(uid).get();
}

/**
 * Get member document data from Firestore
 */
export async function getMemberData({
  firestore,
  uid,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
}): Promise<MemberDocument | undefined> {
  const document = await getMemberDocument({ firestore, uid });
  return document.data() as MemberDocument | undefined;
}

/**
 * Clean up test member documents by prefix
 */
export async function cleanupTestMembers({
  firestore,
}: {
  firestore: ReturnType<typeof getFirestore>;
}) {
  const testDocuments = await firestore
    .collection(MEMBERS_COLLECTION)
    .where("uid", ">=", "test-")
    .where("uid", "<", "test-\u{F8FF}")
    .get();

  const deletionPromises = testDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletionPromises);
}

/**
 * Clean up test documents by email prefix in any collection
 */
export async function cleanupTestDocumentsByEmail({
  firestore,
  collection,
  emailPrefix,
}: {
  firestore: ReturnType<typeof getFirestore>;
  collection: string;
  emailPrefix: string;
}) {
  const testDocuments = await firestore
    .collection(collection)
    .where("email", ">=", emailPrefix)
    .where("email", "<", emailPrefix + "\u{F8FF}")
    .get();

  const deletionPromises = testDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletionPromises);
}

/**
 * Get document by email field in a collection
 */
export async function getDocumentByEmail({
  firestore,
  collection,
  email,
}: {
  firestore: ReturnType<typeof getFirestore>;
  collection: string;
  email: string;
}) {
  const documents = await firestore
    .collection(collection)
    .where("email", "==", email)
    .get();

  return documents.docs[0];
}
