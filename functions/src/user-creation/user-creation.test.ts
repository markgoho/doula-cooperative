import { afterAll, describe, expect, it } from "bun:test";
import { getFirestore } from "firebase-admin/firestore";
import { createMemberOnUserCreated } from "../index.js";
import {
  cleanupTestMembers,
  getMemberData,
  getMemberDocument,
} from "../test-utils/firestore-helpers.js";
import { initializeTest } from "../test-utils/test-setup.js";

const test = initializeTest();

function setup({
  testUid = "test-user-creation-001",
  testEmail = "testcreation001@example.com",
} = {}) {
  const wrappedUserCreate = test.wrap(createMemberOnUserCreated);
  const user = test.auth.makeUserRecord({
    uid: testUid,
    email: testEmail,
  });
  const firestore = getFirestore();

  return { testUid, testEmail, wrappedUserCreate, user, firestore };
}

describe("handleUserCreated", () => {
  afterAll(() => {
    // Cleanup test SDK environment
    test.cleanup();
  });

  it("should create a member document", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup();

    // Act
    await wrappedUserCreate(user);

    // Assert
    const memberDocument = await getMemberDocument({ firestore, uid: testUid });
    expect(memberDocument.exists).toBe(true);

    await cleanupTestMembers({ firestore });
  });

  it("should set the uid field correctly", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup();

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.uid).toBe(testUid);

    await cleanupTestMembers({ firestore });
  });

  it("should set the email field correctly", async () => {
    // Arrange
    const { testUid, testEmail, wrappedUserCreate, user, firestore } = setup();

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.email).toBe(testEmail);

    await cleanupTestMembers({ firestore });
  });

  it("should set membershipActive to false", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup();

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.membershipActive).toBe(false);

    await cleanupTestMembers({ firestore });
  });

  it("should set a createdAt timestamp", async () => {
    // Arrange
    const { testUid, wrappedUserCreate, user, firestore } = setup();

    // Act
    await wrappedUserCreate(user);

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.createdAt).toBeDefined();

    await cleanupTestMembers({ firestore });
  });
});
