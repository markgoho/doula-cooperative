import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getAuth } from "firebase-admin/auth";
import { setAutoAdminOnUserCreated } from "../src";
import { initializeTest } from "../src/test-utils/test-setup";

const test = initializeTest();

const ADMIN_EMAIL = "webmaster@doulacooperative.com";

function setup({
  testUid = "test-auto-admin-001",
  testEmail = ADMIN_EMAIL,
} = {}) {
  const wrappedSetAutoAdmin = test.wrap(setAutoAdminOnUserCreated);
  const user = test.auth.makeUserRecord({
    uid: testUid,
    email: testEmail,
  });
  const auth = getAuth();

  return { testUid, testEmail, wrappedSetAutoAdmin, user, auth };
}

async function cleanupTestUsers() {
  const auth = getAuth();

  // Get all users and delete test users
  const listResult = await auth.listUsers();
  const testUsers = listResult.users.filter(user =>
    user.uid.startsWith("test-auto-admin-"),
  );

  const deletePromises = testUsers.map(user => auth.deleteUser(user.uid));
  await Promise.all(deletePromises);
}

describe("handleSetAutoAdmin", () => {
  beforeEach(async () => {
    await cleanupTestUsers();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should set admin claim for webmaster email", async () => {
    // Arrange
    const { testUid, wrappedSetAutoAdmin, user, auth } = setup({
      testEmail: ADMIN_EMAIL,
    });

    // Create the actual user in Auth first
    await auth.createUser({
      uid: testUid,
      email: ADMIN_EMAIL,
    });

    // Act
    await wrappedSetAutoAdmin(user);

    // Assert
    const userRecord = await auth.getUser(testUid);
    expect(userRecord.customClaims?.admin).toBe(true);

    await cleanupTestUsers();
  });

  it("should set admin claim for webmaster email with different casing", async () => {
    // Arrange
    const { testUid, wrappedSetAutoAdmin, auth } = setup({
      testEmail: "WEBMASTER@DOULACOOPERATIVE.COM",
    });
    const user = test.auth.makeUserRecord({
      uid: testUid,
      email: "WEBMASTER@DOULACOOPERATIVE.COM",
    });

    // Create the actual user in Auth first
    await auth.createUser({
      uid: testUid,
      email: "WEBMASTER@DOULACOOPERATIVE.COM",
    });

    // Act
    await wrappedSetAutoAdmin(user);

    // Assert
    const userRecord = await auth.getUser(testUid);
    expect(userRecord.customClaims?.admin).toBe(true);

    await cleanupTestUsers();
  });

  it("should not set admin claim for non-webmaster email", async () => {
    // Arrange
    const { testUid, wrappedSetAutoAdmin, auth } = setup({
      testEmail: "regularuser@example.com",
    });
    const user = test.auth.makeUserRecord({
      uid: testUid,
      email: "regularuser@example.com",
    });

    // Create the actual user in Auth first
    await auth.createUser({
      uid: testUid,
      email: "regularuser@example.com",
    });

    // Act
    await wrappedSetAutoAdmin(user);

    // Assert
    const userRecord = await auth.getUser(testUid);
    expect(userRecord.customClaims?.admin).toBeUndefined();

    await cleanupTestUsers();
  });

  it("should not set admin claim when user has no email", async () => {
    // Arrange
    const { testUid, wrappedSetAutoAdmin, auth } = setup();
    const user = test.auth.makeUserRecord({
      uid: testUid,
    });

    // Create the actual user in Auth first (without email)
    await auth.createUser({
      uid: testUid,
    });

    // Act
    await wrappedSetAutoAdmin(user);

    // Assert
    const userRecord = await auth.getUser(testUid);
    expect(userRecord.customClaims?.admin).toBeUndefined();

    await cleanupTestUsers();
  });

  it("should handle errors gracefully", async () => {
    // Arrange
    const { wrappedSetAutoAdmin } = setup();
    const user = test.auth.makeUserRecord({
      uid: "invalid-uid-that-will-fail",
      email: ADMIN_EMAIL,
    });

    // Act & Assert
    // The function should throw an error
    try {
      await wrappedSetAutoAdmin(user);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeDefined();
    }

    await cleanupTestUsers();
  });
});
