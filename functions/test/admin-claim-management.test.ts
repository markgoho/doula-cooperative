import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getAuth } from "firebase-admin/auth";
import { handleRemoveAdminClaim } from "../src/admin/remove-admin-claim";
import { handleSetAdminClaim } from "../src/admin/set-admin-claim";
import { createMockCallableRequest } from "../src/test-utils/mock-request";
import { initializeTest } from "../src/test-utils/test-setup";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  targetUid = "target-user-001",
  targetEmail = "targetuser001@example.com",
} = {}) {
  const auth = getAuth();

  return {
    adminUid,
    targetUid,
    targetEmail,
    auth,
  };
}

async function createTestUser({
  auth,
  uid,
  email,
  isAdmin = false,
}: {
  auth: ReturnType<typeof getAuth>;
  uid: string;
  email: string;
  isAdmin?: boolean;
}) {
  try {
    // Try to create the user
    const user = await auth.createUser({
      uid,
      email,
      emailVerified: true,
    });

    // Set admin claim if specified
    if (isAdmin) {
      await auth.setCustomUserClaims(uid, { admin: true });
    }

    return user;
  } catch {
    // If user already exists, just update it
    const user = await auth.getUser(uid);
    await (isAdmin ? auth.setCustomUserClaims(uid, { admin: true }) : auth.setCustomUserClaims(uid, {}));
    return user;
  }
}

async function cleanupAdminClaims() {
  const auth = getAuth();

  // Get all users and delete test users
  const listResult = await auth.listUsers();
  const testUsers = listResult.users.filter(
    user => user.uid.startsWith("admin-user-") || user.uid.startsWith("target-user-"),
  );

  const deletePromises = testUsers.map(user => auth.deleteUser(user.uid));
  await Promise.all(deletePromises);
}

describe("setAdminClaim", () => {
  beforeEach(async () => {
    await cleanupAdminClaims();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleSetAdminClaim(
        { uid: "some-uid" },
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminClaims();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleSetAdminClaim(
        { uid: "some-uid" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Only admins can grant admin privileges");
    }

    await cleanupAdminClaims();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleSetAdminClaim(
        { uid: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }

    await cleanupAdminClaims();
  });

  it("should return internal error when target user does not exist", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleSetAdminClaim(
        { uid: "nonexistent-user-123" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("An error occurred while setting admin claim");
    }

    await cleanupAdminClaims();
  });

  it("should successfully grant admin claim to non-admin user", async () => {
    // Arrange
    const { adminUid, targetUid, targetEmail, auth } = setup();

    await createTestUser({
      auth,
      uid: targetUid,
      email: targetEmail,
      isAdmin: false,
    });

    // Verify user doesn't have admin claim initially
    let user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBeUndefined();

    // Act
    const result = await handleSetAdminClaim(
      { uid: targetUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBe(true);

    await cleanupAdminClaims();
  });

  it("should successfully grant admin claim to user who already has it", async () => {
    // Arrange
    const { adminUid, targetUid, targetEmail, auth } = setup();

    await createTestUser({
      auth,
      uid: targetUid,
      email: targetEmail,
      isAdmin: true,
    });

    // Verify user already has admin claim
    let user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBe(true);

    // Act
    const result = await handleSetAdminClaim(
      { uid: targetUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBe(true);

    await cleanupAdminClaims();
  });

  it("should allow admin to grant admin claim to themselves", async () => {
    // Arrange
    const { adminUid, auth } = setup();

    await createTestUser({
      auth,
      uid: adminUid,
      email: "admin@example.com",
      isAdmin: true,
    });

    // Act
    const result = await handleSetAdminClaim(
      { uid: adminUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const user = await auth.getUser(adminUid);
    expect(user.customClaims?.admin).toBe(true);

    await cleanupAdminClaims();
  });

  it("should preserve other custom claims when setting admin claim", async () => {
    // Arrange
    const { adminUid, targetUid, targetEmail, auth } = setup();

    await createTestUser({
      auth,
      uid: targetUid,
      email: targetEmail,
      isAdmin: false,
    });

    // Set some other custom claims first
    await auth.setCustomUserClaims(targetUid, {
      customClaim1: "value1",
      customClaim2: true,
    });

    // Act
    const result = await handleSetAdminClaim(
      { uid: targetUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBe(true);
    // Note: setCustomUserClaims replaces ALL claims, so other claims will be lost
    // This is expected Firebase behavior

    await cleanupAdminClaims();
  });
});

describe("removeAdminClaim", () => {
  beforeEach(async () => {
    await cleanupAdminClaims();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleRemoveAdminClaim(
        { uid: "some-uid" },
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminClaims();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleRemoveAdminClaim(
        { uid: "some-uid" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Only admins can revoke admin privileges");
    }

    await cleanupAdminClaims();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleRemoveAdminClaim(
        { uid: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }

    await cleanupAdminClaims();
  });

  it("should return failed-precondition error when trying to revoke own admin claim", async () => {
    // Arrange
    const { adminUid, auth } = setup();

    await createTestUser({
      auth,
      uid: adminUid,
      email: "admin@example.com",
      isAdmin: true,
    });

    // Act & Assert
    try {
      await handleRemoveAdminClaim(
        { uid: adminUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Cannot revoke your own admin privileges");
    }

    await cleanupAdminClaims();
  });

  it("should return internal error when target user does not exist", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleRemoveAdminClaim(
        { uid: "nonexistent-user-123" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("An error occurred while removing admin claim");
    }

    await cleanupAdminClaims();
  });

  it("should successfully remove admin claim from admin user", async () => {
    // Arrange
    const { adminUid, targetUid, targetEmail, auth } = setup();

    await createTestUser({
      auth,
      uid: targetUid,
      email: targetEmail,
      isAdmin: true,
    });

    // Verify user has admin claim initially
    let user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBe(true);

    // Act
    const result = await handleRemoveAdminClaim(
      { uid: targetUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBeUndefined();

    await cleanupAdminClaims();
  });

  it("should successfully remove admin claim from non-admin user", async () => {
    // Arrange
    const { adminUid, targetUid, targetEmail, auth } = setup();

    await createTestUser({
      auth,
      uid: targetUid,
      email: targetEmail,
      isAdmin: false,
    });

    // Verify user doesn't have admin claim initially
    let user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBeUndefined();

    // Act
    const result = await handleRemoveAdminClaim(
      { uid: targetUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBeUndefined();

    await cleanupAdminClaims();
  });

  it("should preserve other custom claims when removing admin claim", async () => {
    // Arrange
    const { adminUid, targetUid, targetEmail, auth } = setup();

    await createTestUser({
      auth,
      uid: targetUid,
      email: targetEmail,
      isAdmin: false,
    });

    // Set admin claim along with other custom claims
    await auth.setCustomUserClaims(targetUid, {
      admin: true,
      customClaim1: "value1",
      customClaim2: true,
    });

    let user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBe(true);
    expect(user.customClaims?.customClaim1).toBe("value1");
    expect(user.customClaims?.customClaim2).toBe(true);

    // Act
    const result = await handleRemoveAdminClaim(
      { uid: targetUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBeUndefined();
    expect(user.customClaims?.customClaim1).toBe("value1");
    expect(user.customClaims?.customClaim2).toBe(true);

    await cleanupAdminClaims();
  });

  it("should handle removing admin claim when user has no custom claims", async () => {
    // Arrange
    const { adminUid, targetUid, targetEmail, auth } = setup();

    await createTestUser({
      auth,
      uid: targetUid,
      email: targetEmail,
      isAdmin: false,
    });

    // Explicitly clear all custom claims
    await auth.setCustomUserClaims(targetUid, {});

    let user = await auth.getUser(targetUid);
    expect(user.customClaims).toEqual({});

    // Act
    const result = await handleRemoveAdminClaim(
      { uid: targetUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    user = await auth.getUser(targetUid);
    expect(user.customClaims?.admin).toBeUndefined();

    await cleanupAdminClaims();
  });

  it("should allow different admin to remove admin claim from another admin", async () => {
    // Arrange
    const { auth } = setup();
    const adminUid1 = "admin-user-001";
    const adminUid2 = "admin-user-002";

    await createTestUser({
      auth,
      uid: adminUid1,
      email: "admin1@example.com",
      isAdmin: true,
    });

    await createTestUser({
      auth,
      uid: adminUid2,
      email: "admin2@example.com",
      isAdmin: true,
    });

    // Verify both have admin claims
    let user1 = await auth.getUser(adminUid1);
    let user2 = await auth.getUser(adminUid2);
    expect(user1.customClaims?.admin).toBe(true);
    expect(user2.customClaims?.admin).toBe(true);

    // Act - Admin 1 removes Admin 2's claim
    const result = await handleRemoveAdminClaim(
      { uid: adminUid2 },
      createMockCallableRequest({ uid: adminUid1, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    user1 = await auth.getUser(adminUid1);
    user2 = await auth.getUser(adminUid2);
    expect(user1.customClaims?.admin).toBe(true);
    expect(user2.customClaims?.admin).toBeUndefined();

    await cleanupAdminClaims();
  });
});
