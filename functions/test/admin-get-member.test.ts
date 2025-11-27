import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleGetMember } from "../src/admin/get-member.js";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../src/collections/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  testUid = "test-get-member-001",
  testEmail = "testgetmember001@example.com",
} = {}) {
  const firestore = getFirestore();

  return {
    adminUid,
    testUid,
    testEmail,
    firestore,
  };
}

async function createMemberDocument({
  firestore,
  uid,
  email,
  name,
  membershipActive = true,
  slug,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  name?: string;
  membershipActive?: boolean;

  slug?: string;
}) {
  const memberData: Partial<MemberDocument> = {
    createdAt: Timestamp.now(),
    email,
    uid,
    subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    membershipActive,
    membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
  };

  if (name) {
    memberData.name = name;
  }
  if (slug) {
    memberData.slug = slug;
  }

  await firestore
    .collection(MEMBERS_COLLECTION)
    .doc(uid)
    .set(memberData as MemberDocument);

  return memberData as MemberDocument;
}

async function cleanupAdminGetMember() {
  const firestore = getFirestore();

  const allDocuments = await firestore.collection(MEMBERS_COLLECTION).get();

  const deletePromises = allDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("adminGetMember", () => {
  beforeEach(async () => {
    await cleanupAdminGetMember();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleGetMember({ uid: "some-uid" }, createMockCallableRequest());
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminGetMember();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleGetMember(
        { uid: "some-uid" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupAdminGetMember();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleGetMember(
        { uid: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }

    await cleanupAdminGetMember();
  });

  it("should return not-found error when member does not exist", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleGetMember(
        { uid: testUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Member with UID");
      expect(String(error)).toContain("not found");
    }

    await cleanupAdminGetMember();
  });

  it("should return member data when member exists", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Test Member",
      membershipActive: true,
    });

    // Act
    const result = await handleGetMember(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.uid).toBe(testUid);
    expect(result.email).toBe(testEmail);
    expect(result.name).toBe("Test Member");
    expect(result.membershipActive).toBe(true);

    await cleanupAdminGetMember();
  });

  it("should return member with all fields populated", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Full Member",
      membershipActive: true,

      slug: "full-member",
    });

    // Act
    const result = await handleGetMember(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.uid).toBe(testUid);
    expect(result.email).toBe(testEmail);
    expect(result.name).toBe("Full Member");
    expect(result.membershipActive).toBe(true);
    expect(result.slug).toBe("full-member");
    expect(result.createdAt).toBeDefined();
    expect(result.subscriptionStart).toBeDefined();
    expect(result.membershipExpiresAt).toBeDefined();

    await cleanupAdminGetMember();
  });

  it("should return member with minimal fields", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    // Act
    const result = await handleGetMember(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.uid).toBe(testUid);
    expect(result.email).toBe(testEmail);
    expect(result.name).toBeUndefined();
    expect(result.slug).toBeUndefined();
    expect(result.membershipActive).toBe(false);

    await cleanupAdminGetMember();
  });

  it("should work with inactive members", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Inactive Member",
      membershipActive: false,
    });

    // Act
    const result = await handleGetMember(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.uid).toBe(testUid);
    expect(result.membershipActive).toBe(false);

    await cleanupAdminGetMember();
  });

  it("should work with members who have profiles", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Profile Member",

      slug: "profile-member",
    });

    // Act
    const result = await handleGetMember(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.slug).toBe("profile-member");

    await cleanupAdminGetMember();
  });

  it("should handle special characters in uid", async () => {
    // Arrange
    const { adminUid, firestore } = setup();
    const specialUid = "test-special-!@#$%^&*()";
    const testEmail = "special@example.com";

    await createMemberDocument({
      firestore,
      uid: specialUid,
      email: testEmail,
      name: "Special UID Member",
    });

    // Act
    const result = await handleGetMember(
      { uid: specialUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.uid).toBe(specialUid);

    await cleanupAdminGetMember();
  });

  it("should preserve all timestamp fields", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();
    const createdAt = Timestamp.fromDate(new Date("2024-01-15T10:30:00Z"));
    const subscriptionStart = Timestamp.fromDate(
      new Date("2024-02-01T00:00:00Z"),
    );
    const membershipExpiresAt = Timestamp.fromDate(
      new Date("2025-02-01T00:00:00Z"),
    );

    const memberData: MemberDocument = {
      createdAt,
      email: testEmail,
      uid: testUid,
      subscriptionStart,
      membershipActive: true,
      membershipExpiresAt,
    };

    await firestore.collection(MEMBERS_COLLECTION).doc(testUid).set(memberData);

    // Act
    const result = await handleGetMember(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.createdAt).toEqual(createdAt);
    expect(result.subscriptionStart).toEqual(subscriptionStart);
    expect(result.membershipExpiresAt).toEqual(membershipExpiresAt);

    await cleanupAdminGetMember();
  });

  it("should include isAdmin field set to false for non-admin users", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Regular User",
    });

    // Act
    const result = await handleGetMember(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.isAdmin).toBe(false);

    await cleanupAdminGetMember();
  });
});
