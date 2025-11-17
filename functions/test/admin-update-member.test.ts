import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleUpdateMember } from "../src/admin/update-member.js";
import { MEMBERS_COLLECTION } from "../src/collections/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";
import { type MemberDocument } from "../src/collections/index.js";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  testUid = "test-update-member-001",
  testEmail = "testupdatemember001@example.com",
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
  subscriptionStart,
  membershipExpiresAt,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  name?: string;
  membershipActive?: boolean;
  
  slug?: string;
  subscriptionStart?: Timestamp;
  membershipExpiresAt?: Timestamp;
}) {
  const memberData: Partial<MemberDocument> = {
    createdAt: Timestamp.now(),
    email,
    uid,
    subscriptionStart: subscriptionStart ?? Timestamp.fromDate(new Date("2024-01-15")),
    membershipActive,
    membershipExpiresAt: membershipExpiresAt ?? Timestamp.fromDate(new Date("2025-01-31")),
  };

  if (name) {
    memberData.name = name;
  }
  if (slug) {
    memberData.slug = slug;
  }

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData as MemberDocument);

  return memberData as MemberDocument;
}

async function cleanupAdminUpdateMember() {
  const firestore = getFirestore();

  const allDocuments = await firestore
    .collection(MEMBERS_COLLECTION)
    .get();

  const deletePromises = allDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("adminUpdateMember", () => {
  beforeEach(async () => {
    await cleanupAdminUpdateMember();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleUpdateMember(
        { uid: "some-uid", updates: { name: "Test" } },
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminUpdateMember();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleUpdateMember(
        { uid: "some-uid", updates: { name: "Test" } },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupAdminUpdateMember();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleUpdateMember(
        { uid: "", updates: { name: "Test" } },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }

    await cleanupAdminUpdateMember();
  });

  it("should return invalid-argument error when no updates provided", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleUpdateMember(
        { uid: testUid, updates: {} },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("No updates provided");
    }

    await cleanupAdminUpdateMember();
  });

  it("should return invalid-argument error when trying to update uid", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleUpdateMember(
        { uid: testUid, updates: { uid: "new-uid" } },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Cannot update protected field");
      expect(String(error)).toContain("uid");
    }

    await cleanupAdminUpdateMember();
  });

  it("should return invalid-argument error when trying to update createdAt", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleUpdateMember(
        { uid: testUid, updates: { createdAt: Timestamp.now() } },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Cannot update protected field");
      expect(String(error)).toContain("createdAt");
    }

    await cleanupAdminUpdateMember();
  });

  it("should return not-found error when member does not exist", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleUpdateMember(
        { uid: testUid, updates: { name: "Test" } },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Member with UID");
      expect(String(error)).toContain("not found");
    }

    await cleanupAdminUpdateMember();
  });

  it("should successfully update name field", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Old Name",
    });

    // Act
    const result = await handleUpdateMember(
      { uid: testUid, updates: { name: "New Name" } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.name).toBe("New Name");

    await cleanupAdminUpdateMember();
  });

  it("should successfully update membershipActive field", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: true,
    });

    // Act
    const result = await handleUpdateMember(
      { uid: testUid, updates: { membershipActive: false } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(false);

    await cleanupAdminUpdateMember();
  });

  it("should successfully update slug field", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    // Act
    const result = await handleUpdateMember(
      { uid: testUid, updates: { slug: "new-slug" } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.slug).toBe("new-slug");

    await cleanupAdminUpdateMember();
  });

  it("should successfully update email field", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    // Act
    const result = await handleUpdateMember(
      { uid: testUid, updates: { email: "newemail@example.com" } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.email).toBe("newemail@example.com");

    await cleanupAdminUpdateMember();
  });

  it("should convert string date to Timestamp for subscriptionStart", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    const newDate = "2024-06-15T00:00:00Z";

    // Act
    const result = await handleUpdateMember(
      { uid: testUid, updates: { subscriptionStart: newDate as unknown as Timestamp } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.subscriptionStart).toBeInstanceOf(Timestamp);
    expect(updatedData.subscriptionStart).toBeDefined();
    if (updatedData.subscriptionStart) {
      expect(updatedData.subscriptionStart.toDate().toISOString()).toContain("2024-06-15T00:00:00");
    }

    await cleanupAdminUpdateMember();
  });

  it("should convert string date to Timestamp for membershipExpiresAt", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    const newDate = "2025-12-31T23:59:59Z";

    // Act
    const result = await handleUpdateMember(
      { uid: testUid, updates: { membershipExpiresAt: newDate as unknown as Timestamp } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeInstanceOf(Timestamp);
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain("2025-12-31T23:59:59");
    }

    await cleanupAdminUpdateMember();
  });

  it("should update multiple fields at once", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Old Name",
      membershipActive: false,
      
    });

    // Act
    const result = await handleUpdateMember(
      {
        uid: testUid,
        updates: {
          name: "New Name",
          membershipActive: true,
          
          slug: "new-member-slug",
        },
      },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.name).toBe("New Name");
    expect(updatedData.membershipActive).toBe(true);
    expect(updatedData.slug).toBe("new-member-slug");

    await cleanupAdminUpdateMember();
  });

  it("should preserve fields that are not being updated", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    const originalCreatedAt = Timestamp.fromDate(new Date("2024-01-01"));
    const originalSubscriptionStart = Timestamp.fromDate(new Date("2024-02-01"));
    const originalMembershipExpiresAt = Timestamp.fromDate(new Date("2025-02-01"));

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Original Name",
      membershipActive: true,
      
      slug: "original-slug",
      subscriptionStart: originalSubscriptionStart,
      membershipExpiresAt: originalMembershipExpiresAt,
    });

    // Manually set createdAt to specific value
    await firestore.collection(MEMBERS_COLLECTION).doc(testUid).update({
      createdAt: originalCreatedAt,
    });

    // Act - only update name
    const result = await handleUpdateMember(
      { uid: testUid, updates: { name: "Updated Name" } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.name).toBe("Updated Name");
    expect(updatedData.email).toBe(testEmail);
    expect(updatedData.membershipActive).toBe(true);
    expect(updatedData.slug).toBe("original-slug");
    expect(updatedData.createdAt).toEqual(originalCreatedAt);
    expect(updatedData.subscriptionStart).toEqual(originalSubscriptionStart);
    expect(updatedData.membershipExpiresAt).toEqual(originalMembershipExpiresAt);

    await cleanupAdminUpdateMember();
  });

  it("should handle Timestamp objects for date fields", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    const newTimestamp = Timestamp.fromDate(new Date("2024-08-15"));

    // Act
    const result = await handleUpdateMember(
      { uid: testUid, updates: { subscriptionStart: newTimestamp } },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore.collection(MEMBERS_COLLECTION).doc(testUid).get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.subscriptionStart).toEqual(newTimestamp);

    await cleanupAdminUpdateMember();
  });
});
