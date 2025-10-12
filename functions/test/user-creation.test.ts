import { afterAll, describe, expect, it } from "bun:test";
import { getFirestore } from "firebase-admin/firestore";
import firebaseFunctionsTest from "firebase-functions-test";
import { createMemberOnUserCreated } from "../src";
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

function setup({ testUid, testEmail }: { testUid: string; testEmail: string }) {
  const wrappedUserCreate = test.wrap(createMemberOnUserCreated);
  const user = test.auth.makeUserRecord({
    uid: testUid,
    email: testEmail,
  });
  const firestore = getFirestore();

  return { testUid, testEmail, wrappedUserCreate, user, firestore };
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

async function getMemberData({
  firestore,
  uid,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
}): Promise<MemberDocument | undefined> {
  const document = await getMemberDocument({ firestore, uid });
  return document.data() as MemberDocument | undefined;
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

describe("handleUserCreated", () => {
  afterAll(() => {
    // Cleanup test SDK environment
    test.cleanup();
  });

  it("should create a member document", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup({
      testUid: "test-user-001",
      testEmail: "test001@example.com",
    });

    // Act
    await wrappedUserCreate(user);

    // Assert
    const memberDocument = await getMemberDocument({ firestore, uid: testUid });
    expect(memberDocument.exists).toBe(true);

    await cleanup();
  });

  it("should set the uid field correctly", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup({
      testUid: "test-user-002",
      testEmail: "test002@example.com",
    });

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.uid).toBe(testUid);

    await cleanup();
  });

  it("should set the email field correctly", async () => {
    // Arrange
    const { testUid, testEmail, wrappedUserCreate, user, firestore } = setup({
      testUid: "test-user-003",
      testEmail: "test003@example.com",
    });

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.email).toBe(testEmail);

    await cleanup();
  });

  it("should set membershipActive to false", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup({
      testUid: "test-user-004",
      testEmail: "test004@example.com",
    });

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.membershipActive).toBe(false);

    await cleanup();
  });

  it("should set a createdAt timestamp", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup({
      testUid: "test-user-005",
      testEmail: "test005@example.com",
    });

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.createdAt).toBeDefined();

    await cleanup();
  });
});
