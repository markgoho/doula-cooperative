import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleExtendMembership } from "../src/admin/extend-membership.js";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../src/collections/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  testUid = "test-extend-membership-001",
  testEmail = "testextendmembership001@example.com",
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
  membershipExpiresAt,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  name?: string;
  membershipActive?: boolean;

  slug?: string;
  membershipExpiresAt?: Timestamp;
}) {
  const memberData: Partial<MemberDocument> = {
    createdAt: Timestamp.now(),
    email,
    uid,
    subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    membershipActive,
    membershipExpiresAt:
      membershipExpiresAt ?? Timestamp.fromDate(new Date("2025-01-31")),
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

async function cleanupExtendMembership() {
  const firestore = getFirestore();

  const allDocuments = await firestore.collection(MEMBERS_COLLECTION).get();

  const deletePromises = allDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("adminExtendMembership", () => {
  beforeEach(async () => {
    await cleanupExtendMembership();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleExtendMembership(
        { uid: "some-uid", newExpirationDate: "2026-01-01" },
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupExtendMembership();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleExtendMembership(
        { uid: "some-uid", newExpirationDate: "2026-01-01" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupExtendMembership();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleExtendMembership(
        { uid: "", newExpirationDate: "2026-01-01" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }

    await cleanupExtendMembership();
  });

  it("should return invalid-argument error when newExpirationDate is missing", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleExtendMembership(
        { uid: testUid, newExpirationDate: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("New expiration date is required");
    }

    await cleanupExtendMembership();
  });

  it("should return not-found error when member does not exist", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleExtendMembership(
        { uid: testUid, newExpirationDate: "2026-01-01" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Member with UID");
      expect(String(error)).toContain("not found");
    }

    await cleanupExtendMembership();
  });

  it("should successfully extend membership expiration date", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    const originalExpiration = Timestamp.fromDate(new Date("2025-01-31"));
    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: true,
      membershipExpiresAt: originalExpiration,
    });

    const newExpirationDate = "2026-06-30T23:59:59Z";

    // Act
    const result = await handleExtendMembership(
      { uid: testUid, newExpirationDate },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2026-06-30T23:59:59",
      );
    }

    await cleanupExtendMembership();
  });

  it("should preserve other fields when extending membership", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    const originalStart = Timestamp.fromDate(new Date("2024-01-15"));
    const originalCreatedAt = Timestamp.fromDate(new Date("2024-01-01"));

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      name: "Test Member",
      membershipActive: true,

      slug: "test-member",
    });

    // Manually set specific timestamps
    await firestore.collection(MEMBERS_COLLECTION).doc(testUid).update({
      subscriptionStart: originalStart,
      createdAt: originalCreatedAt,
    });

    const newExpirationDate = "2027-01-01T00:00:00Z";

    // Act
    const result = await handleExtendMembership(
      { uid: testUid, newExpirationDate },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2027-01-01T00:00:00",
      );
    }
    expect(updatedData.name).toBe("Test Member");
    expect(updatedData.email).toBe(testEmail);
    expect(updatedData.membershipActive).toBe(true);
    expect(updatedData.slug).toBe("test-member");
    expect(updatedData.subscriptionStart).toEqual(originalStart);
    expect(updatedData.createdAt).toEqual(originalCreatedAt);

    await cleanupExtendMembership();
  });

  it("should extend membership for inactive member", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    const newExpirationDate = "2026-12-31T23:59:59Z";

    // Act
    const result = await handleExtendMembership(
      { uid: testUid, newExpirationDate },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2026-12-31T23:59:59",
      );
    }
    expect(updatedData.membershipActive).toBe(false); // Should remain inactive

    await cleanupExtendMembership();
  });

  it("should handle extending to earlier date (shortening)", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    const originalExpiration = Timestamp.fromDate(new Date("2027-12-31"));
    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: true,
      membershipExpiresAt: originalExpiration,
    });

    const newExpirationDate = "2026-01-01T00:00:00Z";

    // Act
    const result = await handleExtendMembership(
      { uid: testUid, newExpirationDate },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2026-01-01T00:00:00",
      );
    }

    await cleanupExtendMembership();
  });

  it("should handle ISO date strings with different formats", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    // Date string without time component
    const newExpirationDate = "2026-08-15";

    // Act
    const result = await handleExtendMembership(
      { uid: testUid, newExpirationDate },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeInstanceOf(Timestamp);
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2026-08-15",
      );
    }

    await cleanupExtendMembership();
  });

  it("should handle extending membership multiple times", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-01")),
    });

    // Act - First extension
    await handleExtendMembership(
      { uid: testUid, newExpirationDate: "2026-01-01T00:00:00Z" },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    let updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    let updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2026-01-01T00:00:00",
      );
    }

    // Act - Second extension
    await handleExtendMembership(
      { uid: testUid, newExpirationDate: "2027-06-15T00:00:00Z" },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2027-06-15T00:00:00",
      );
    }

    // Act - Third extension
    const result = await handleExtendMembership(
      { uid: testUid, newExpirationDate: "2028-12-31T23:59:59Z" },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2028-12-31T23:59:59",
      );
    }

    await cleanupExtendMembership();
  });

  it("should handle date in the past", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: true,
    });

    const pastDate = "2020-01-01T00:00:00Z";

    // Act
    const result = await handleExtendMembership(
      { uid: testUid, newExpirationDate: pastDate },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2020-01-01T00:00:00",
      );
    }

    await cleanupExtendMembership();
  });
});
