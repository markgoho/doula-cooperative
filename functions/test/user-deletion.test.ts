import { afterAll, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../src/collections/index.js";
import { deleteMemberOnUserDeleted } from "../src/index.js";
import {
  cleanupTestMembers,
  getMemberDocument,
} from "../src/test-utils/firestore-helpers.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();

async function setup({
  testUid = "test-user-delete-001",
  testEmail = "testdelete001@example.com",
} = {}) {
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

    await cleanupTestMembers({ firestore });
  });
});
