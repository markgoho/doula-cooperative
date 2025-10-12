import { afterAll, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import firebaseFunctionsTest from "firebase-functions-test";
import { deleteMemberOnUserDeleted } from "../src";
import { type MemberDocument } from "../src/types/member-document";

// Configure Firestore to use emulator (must be set before initializing)
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

// Initialize in online mode using emulator with dedicated test project ID
const test = firebaseFunctionsTest(
  {
    projectId: "doula-cooperative-test",
  },
  "./service-account-key.json", // This can be a dummy path for emulator
);

const MEMBERS_COLLECTION = "members";

const SETUP_DEFAULTS: SetupOptions = {
  testUid: "test-user-delete-001",
  testEmail: "testdelete001@example.com",
};

interface SetupOptions {
  testUid: string;
  testEmail: string;
}

async function setup({ testUid, testEmail }: SetupOptions = SETUP_DEFAULTS) {
  const wrappedUserDelete = test.wrap(deleteMemberOnUserDeleted);
  const user = test.auth.makeUserRecord({
    uid: testUid,
    email: testEmail,
  });
  const firestore = getFirestore();

  await createTestMemberDocument({
    firestore,
    uid: testUid,
    email: testEmail,
  });

  return { testUid, testEmail, wrappedUserDelete, user, firestore };
}

async function createTestMemberDocument({
  firestore,
  uid,
  email,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
}) {
  const memberData: MemberDocument = {
    uid,
    email,
    membershipActive: false,
    createdAt: Timestamp.now(),
  };

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);
}

async function getMemberDocument({
  firestore,
  uid,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
}) {
  return firestore.collection(MEMBERS_COLLECTION).doc(uid).get();
}

async function cleanup() {
  // Clean up all test data by querying for documents with test prefix
  const firestore = getFirestore();
  const testDocuments = await firestore
    .collection(MEMBERS_COLLECTION)
    .where("uid", ">=", "test-")
    .where("uid", "<", "test-\uF8FF")
    .get();

  const deletePromises = testDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("deleteMemberOnUserDeleted", () => {
  afterAll(() => {
    test.cleanup();
  });

  it("should delete the member document when user is deleted", async () => {
    // Arrange
    const { testUid, wrappedUserDelete, user, firestore } = await setup();

    const beforeDeletion = await getMemberDocument({ firestore, uid: testUid });
    expect(beforeDeletion.exists).toBe(true);

    // Act
    await wrappedUserDelete(user);

    // Assert
    const afterDeletion = await getMemberDocument({ firestore, uid: testUid });
    expect(afterDeletion.exists).toBe(false);

    await cleanup();
  });
});
