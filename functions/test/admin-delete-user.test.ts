import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleDeleteUser } from "../src/admin/delete-user.js";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../src/collections/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  targetUserUid = "test-delete-user-001",
  targetUserEmail = "testdeleteuser001@example.com",
} = {}) {
  const firestore = getFirestore();
  const auth = getAuth();

  return {
    adminUid,
    targetUserUid,
    targetUserEmail,
    firestore,
    auth,
  };
}

async function createTestUser({
  auth,
  firestore,
  uid,
  email,
}: {
  auth: ReturnType<typeof getAuth>;
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
}) {
  // Create Auth user
  await auth.createUser({
    uid,
    email,
    password: "test-password-123",
  });

  // Create member document
  const memberData: MemberDocument = {
    uid,
    email,
    membershipActive: false,
    createdAt: Timestamp.now(),
  };

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);
}

async function cleanupDeleteUser({
  auth,
  firestore,
  uid,
}: {
  auth: ReturnType<typeof getAuth>;
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
}) {
  try {
    await auth.deleteUser(uid);
  } catch {
    // User might not exist, that's ok
  }

  try {
    await firestore.collection(MEMBERS_COLLECTION).doc(uid).delete();
  } catch {
    // Document might not exist, that's ok
  }
}

describe("adminDeleteUser", () => {
  beforeEach(async () => {
    const { auth, firestore, targetUserUid } = setup();
    await cleanupDeleteUser({ auth, firestore, uid: targetUserUid });
    // Also clean up the orphaned user if it exists
    await cleanupDeleteUser({ auth, firestore, uid: "orphaned-auth-user-001" });
  });

  afterAll(async () => {
    // Clean up any remaining test users
    const { auth, firestore, targetUserUid } = setup();
    await cleanupDeleteUser({ auth, firestore, uid: targetUserUid });
    await cleanupDeleteUser({ auth, firestore, uid: "orphaned-auth-user-001" });
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleDeleteUser({ uid: "some-uid" }, createMockCallableRequest());
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleDeleteUser(
        { uid: "some-uid" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleDeleteUser(
        { uid: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }
  });

  it("should return permission-denied error when trying to delete own account", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleDeleteUser(
        { uid: adminUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("cannot delete your own account");
    }
  });

  it("should return permission-denied error when trying to delete an admin user", async () => {
    // Arrange
    const { adminUid, auth, firestore } = setup();
    const otherAdminUid = "other-admin-user-001";
    const otherAdminEmail = "otheradmin@example.com";

    // Create an admin user
    await auth.createUser({
      uid: otherAdminUid,
      email: otherAdminEmail,
    });

    // Set admin claim
    await auth.setCustomUserClaims(otherAdminUid, { admin: true });

    // Create member document
    const memberData: MemberDocument = {
      uid: otherAdminUid,
      email: otherAdminEmail,
      membershipActive: false,
      createdAt: Timestamp.now(),
    };
    await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(otherAdminUid)
      .set(memberData);

    // Act & Assert
    try {
      await handleDeleteUser(
        { uid: otherAdminUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Cannot delete admin users");
      expect(String(error)).toContain("Remove admin privileges first");
    } finally {
      await cleanupDeleteUser({ auth, firestore, uid: otherAdminUid });
    }
  });

  it("should return not-found error when user does not exist in Auth", async () => {
    // Arrange
    const { adminUid, auth, firestore } = setup();
    const nonExistentUid = "non-existent-user-999";

    // Make sure user doesn't exist
    await cleanupDeleteUser({ auth, firestore, uid: nonExistentUid });

    // Act & Assert
    try {
      await handleDeleteUser(
        { uid: nonExistentUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("User with UID");
      expect(String(error)).toContain("not found");
    }
  });

  it("should return not-found error when member document does not exist", async () => {
    // Arrange
    const { adminUid, auth, firestore } = setup();
    const orphanedAuthUid = "orphaned-auth-user-001";

    // Create only Auth user, no member document
    await auth.createUser({
      uid: orphanedAuthUid,
      email: "orphaned@example.com",
    });

    // Wait for createMemberOnUserCreated trigger to complete, then delete the member document
    // to create the orphaned state we want to test
    await new Promise(resolve => setTimeout(resolve, 100));
    await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(orphanedAuthUid)
      .delete();

    // Act & Assert
    try {
      await handleDeleteUser(
        { uid: orphanedAuthUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Member with UID");
      expect(String(error)).toContain("not found");
    } finally {
      await cleanupDeleteUser({ auth, firestore, uid: orphanedAuthUid });
    }
  });

  it("should successfully delete user from Auth", async () => {
    // Arrange
    const { adminUid, targetUserUid, targetUserEmail, auth, firestore } =
      setup();

    await createTestUser({
      auth,
      firestore,
      uid: targetUserUid,
      email: targetUserEmail,
    });

    // Verify user exists before deletion
    const userBeforeDeletion = await auth.getUser(targetUserUid);
    expect(userBeforeDeletion.uid).toBe(targetUserUid);

    const memberBeforeDeletion = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(targetUserUid)
      .get();
    expect(memberBeforeDeletion.exists).toBe(true);

    // Act
    const result = await handleDeleteUser(
      { uid: targetUserUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    // Verify user is deleted from Auth
    try {
      await auth.getUser(targetUserUid);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("no user record");
    }

    // Note: Member document deletion is handled by the deleteMemberOnUserDeleted
    // trigger, which is tested separately in user-deletion.test.ts
    await cleanupDeleteUser({ auth, firestore, uid: targetUserUid });
  });
});
