import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleActivateMembership } from "../src/admin/activate-membership.js";
import { handleDeactivateMembership } from "../src/admin/deactivate-membership.js";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../src/collections/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  testUid = "test-membership-status-001",
  testEmail = "testmembershipstatus001@example.com",
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

async function cleanupMembershipStatus() {
  const firestore = getFirestore();

  const allDocuments = await firestore.collection(MEMBERS_COLLECTION).get();

  const deletePromises = allDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("adminActivateMembership", () => {
  beforeEach(async () => {
    await cleanupMembershipStatus();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleActivateMembership(
        { uid: "some-uid" },
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupMembershipStatus();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleActivateMembership(
        { uid: "some-uid" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupMembershipStatus();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleActivateMembership(
        { uid: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }

    await cleanupMembershipStatus();
  });

  it("should return not-found error when member does not exist", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleActivateMembership(
        { uid: testUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Member with UID");
      expect(String(error)).toContain("not found");
    }

    await cleanupMembershipStatus();
  });

  it("should activate membership with default dates", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    const beforeActivation = Date.now();

    // Act
    const result = await handleActivateMembership(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    const afterActivation = Date.now();

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(true);

    // Verify subscriptionStart is around current time
    expect(updatedData.subscriptionStart).toBeDefined();
    if (!updatedData.subscriptionStart) {
      throw new Error("subscriptionStart is undefined");
    }
    const startMillis = updatedData.subscriptionStart.toMillis();
    expect(startMillis).toBeGreaterThanOrEqual(beforeActivation);
    expect(startMillis).toBeLessThanOrEqual(afterActivation);

    // Verify membershipExpiresAt is approximately one year from now
    const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (!updatedData.membershipExpiresAt) {
      throw new Error("membershipExpiresAt is undefined");
    }
    const expiresMillis = updatedData.membershipExpiresAt.toMillis();
    expect(expiresMillis).toBeGreaterThanOrEqual(oneYearFromNow - 5000); // 5 second tolerance
    expect(expiresMillis).toBeLessThanOrEqual(oneYearFromNow + 5000);

    await cleanupMembershipStatus();
  });

  it("should activate membership with custom dates", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    const customStart = "2024-03-01T00:00:00Z";
    const customExpires = "2025-03-01T00:00:00Z";

    // Act
    const result = await handleActivateMembership(
      {
        uid: testUid,
        subscriptionStart: customStart,
        membershipExpiresAt: customExpires,
      },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(true);
    expect(updatedData.subscriptionStart).toBeDefined();
    if (updatedData.subscriptionStart) {
      expect(updatedData.subscriptionStart.toDate().toISOString()).toContain(
        "2024-03-01T00:00:00",
      );
    }
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2025-03-01T00:00:00",
      );
    }

    await cleanupMembershipStatus();
  });

  it("should activate membership with only custom start date", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    const customStart = "2024-06-15T00:00:00Z";

    // Act
    const result = await handleActivateMembership(
      {
        uid: testUid,
        subscriptionStart: customStart,
      },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(true);
    expect(updatedData.subscriptionStart).toBeDefined();
    if (updatedData.subscriptionStart) {
      expect(updatedData.subscriptionStart.toDate().toISOString()).toContain(
        "2024-06-15T00:00:00",
      );
    }

    // Expires should still be ~1 year from current time (not from custom start)
    const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000;
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (!updatedData.membershipExpiresAt) {
      throw new Error("membershipExpiresAt is undefined");
    }
    const expiresMillis = updatedData.membershipExpiresAt.toMillis();
    expect(expiresMillis).toBeGreaterThanOrEqual(oneYearFromNow - 5000);
    expect(expiresMillis).toBeLessThanOrEqual(oneYearFromNow + 5000);

    await cleanupMembershipStatus();
  });

  it("should activate membership with only custom expiration date", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    const customExpires = "2026-12-31T23:59:59Z";
    const beforeActivation = Date.now();

    // Act
    const result = await handleActivateMembership(
      {
        uid: testUid,
        membershipExpiresAt: customExpires,
      },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    const afterActivation = Date.now();

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(true);

    // Start should be current time
    expect(updatedData.subscriptionStart).toBeDefined();
    if (!updatedData.subscriptionStart) {
      throw new Error("subscriptionStart is undefined");
    }
    const startMillis = updatedData.subscriptionStart.toMillis();
    expect(startMillis).toBeGreaterThanOrEqual(beforeActivation);
    expect(startMillis).toBeLessThanOrEqual(afterActivation);

    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2026-12-31T23:59:59",
      );
    }

    await cleanupMembershipStatus();
  });

  it("should activate already active membership", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: true,
    });

    const newExpires = "2026-01-01T00:00:00Z";

    // Act
    const result = await handleActivateMembership(
      {
        uid: testUid,
        membershipExpiresAt: newExpires,
      },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(true);
    expect(updatedData.membershipExpiresAt).toBeDefined();
    if (updatedData.membershipExpiresAt) {
      expect(updatedData.membershipExpiresAt.toDate().toISOString()).toContain(
        "2026-01-01T00:00:00",
      );
    }

    await cleanupMembershipStatus();
  });
});

describe("adminDeactivateMembership", () => {
  beforeEach(async () => {
    await cleanupMembershipStatus();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleDeactivateMembership(
        { uid: "some-uid" },
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupMembershipStatus();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleDeactivateMembership(
        { uid: "some-uid" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupMembershipStatus();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleDeactivateMembership(
        { uid: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("UID is required");
    }

    await cleanupMembershipStatus();
  });

  it("should return not-found error when member does not exist", async () => {
    // Arrange
    const { adminUid, testUid } = setup();

    // Act & Assert
    try {
      await handleDeactivateMembership(
        { uid: testUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Member with UID");
      expect(String(error)).toContain("not found");
    }

    await cleanupMembershipStatus();
  });

  it("should deactivate active membership", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: true,
    });

    // Act
    const result = await handleDeactivateMembership(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(false);

    await cleanupMembershipStatus();
  });

  it("should deactivate already inactive membership", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    // Act
    const result = await handleDeactivateMembership(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(false);

    await cleanupMembershipStatus();
  });

  it("should preserve other fields when deactivating", async () => {
    // Arrange
    const { adminUid, testUid, testEmail, firestore } = setup();

    const originalStart = Timestamp.fromDate(new Date("2024-01-15"));
    const originalExpires = Timestamp.fromDate(new Date("2025-01-15"));

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
      membershipExpiresAt: originalExpires,
    });

    // Act
    const result = await handleDeactivateMembership(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.success).toBe(true);

    const updatedDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const updatedData = updatedDocument.data() as MemberDocument;
    expect(updatedData.membershipActive).toBe(false);
    expect(updatedData.name).toBe("Test Member");
    expect(updatedData.email).toBe(testEmail);
    expect(updatedData.slug).toBe("test-member");
    expect(updatedData.subscriptionStart).toEqual(originalStart);
    expect(updatedData.membershipExpiresAt).toEqual(originalExpires);

    await cleanupMembershipStatus();
  });
});
