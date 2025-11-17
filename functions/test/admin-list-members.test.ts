import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleListMembers } from "../src/admin/list-members.js";
import { MEMBERS_COLLECTION } from "../src/constants/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";
import { type MemberDocument } from "../src/types/member-document.js";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
} = {}) {
  const firestore = getFirestore();

  return {
    adminUid,
    firestore,
  };
}

async function createMemberDocument({
  firestore,
  uid,
  email,
  name,
  createdAt,
  membershipActive = true,
  slug,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  name?: string;
  createdAt: Timestamp;
  membershipActive?: boolean;
  
  slug?: string;
}) {
  const memberData: Partial<MemberDocument> = {
    createdAt,
    email,
    uid,
    subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    membershipActive,
    membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
  };

  // Only add name and slug if they're provided
  if (name) {
    memberData.name = name;
  }
  if (slug) {
    memberData.slug = slug;
  }

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData as MemberDocument);

  return memberData as MemberDocument;
}

async function cleanupAdminListMembers() {
  const firestore = getFirestore();

  // Clean up ALL members to ensure clean state for each test
  const allDocuments = await firestore
    .collection(MEMBERS_COLLECTION)
    .get();

  const deletePromises = allDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("adminListMembers", () => {
  beforeEach(async () => {
    await cleanupAdminListMembers();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleListMembers(
        {},
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminListMembers();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleListMembers(
        {},
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupAdminListMembers();
  });

  it("should return empty array when no members exist", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members).toEqual([]);
    expect(result.total).toBe(0);

    await cleanupAdminListMembers();
  });

  it("should return all members when no pagination specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: "test-list-001",
      email: "test001@example.com",
      name: "User One",
      createdAt: Timestamp.fromDate(new Date("2024-01-01")),
    });

    await createMemberDocument({
      firestore,
      uid: "test-list-002",
      email: "test002@example.com",
      name: "User Two",
      createdAt: Timestamp.fromDate(new Date("2024-01-02")),
    });

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members.length).toBe(2);
    expect(result.total).toBe(2);

    await cleanupAdminListMembers();
  });

  it("should order members by creation date descending", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: "test-order-001",
      email: "older@example.com",
      name: "Older User",
      createdAt: Timestamp.fromDate(new Date("2024-01-01")),
    });

    await createMemberDocument({
      firestore,
      uid: "test-order-002",
      email: "newer@example.com",
      name: "Newer User",
      createdAt: Timestamp.fromDate(new Date("2024-01-15")),
    });

    await createMemberDocument({
      firestore,
      uid: "test-order-003",
      email: "newest@example.com",
      name: "Newest User",
      createdAt: Timestamp.fromDate(new Date("2024-01-20")),
    });

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members[0].email).toBe("newest@example.com");
    expect(result.members[1].email).toBe("newer@example.com");
    expect(result.members[2].email).toBe("older@example.com");

    await cleanupAdminListMembers();
  });

  it("should respect limit parameter", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 5; index++) {
      await createMemberDocument({
        firestore,
        uid: `test-limit-${String(index).padStart(3, "0")}`,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        createdAt: Timestamp.fromDate(new Date(`2024-01-${String(index).padStart(2, "0")}`)),
      });
    }

    // Act
    const result = await handleListMembers(
      { limit: 3 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members.length).toBe(3);
    expect(result.total).toBe(5);

    await cleanupAdminListMembers();
  });

  it("should respect offset parameter", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 5; index++) {
      await createMemberDocument({
        firestore,
        uid: `test-offset-${String(index).padStart(3, "0")}`,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        createdAt: Timestamp.fromDate(new Date(`2024-01-${String(index).padStart(2, "0")}`)),
      });
    }

    // Act
    const result = await handleListMembers(
      { offset: 2 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members.length).toBe(3);
    expect(result.total).toBe(5);
    // Should skip first 2 (newest), so first result should be 3rd newest
    expect(result.members[0].uid).toBe("test-offset-003");

    await cleanupAdminListMembers();
  });

  it("should handle both limit and offset together", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 10; index++) {
      await createMemberDocument({
        firestore,
        uid: `test-page-${String(index).padStart(3, "0")}`,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        createdAt: Timestamp.fromDate(new Date(`2024-01-${String(index).padStart(2, "0")}`)),
      });
    }

    // Act - Get second page of 3 items
    const result = await handleListMembers(
      { limit: 3, offset: 3 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members.length).toBe(3);
    expect(result.total).toBe(10);
    // Should get items 4-6 from newest (10,9,8 are first 3; 7,6,5 are second 3)
    expect(result.members[0].uid).toBe("test-page-007");
    expect(result.members[1].uid).toBe("test-page-006");
    expect(result.members[2].uid).toBe("test-page-005");

    await cleanupAdminListMembers();
  });

  it("should use default limit of 50 when not specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    // Create 52 members
    for (let index = 1; index <= 52; index++) {
      await createMemberDocument({
        firestore,
        uid: `test-default-${String(index).padStart(3, "0")}`,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        createdAt: Timestamp.fromDate(new Date("2024-01-01")),
      });
    }

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert - should only get 50 (default limit)
    expect(result.members.length).toBe(50);
    expect(result.total).toBe(52);

    await cleanupAdminListMembers();
  });

  it("should use default offset of 0 when not specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: "test-default-offset-001",
      email: "newest@example.com",
      name: "Newest User",
      createdAt: Timestamp.fromDate(new Date("2024-01-20")),
    });

    await createMemberDocument({
      firestore,
      uid: "test-default-offset-002",
      email: "older@example.com",
      name: "Older User",
      createdAt: Timestamp.fromDate(new Date("2024-01-10")),
    });

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert - should start from beginning (newest)
    expect(result.members[0].email).toBe("newest@example.com");

    await cleanupAdminListMembers();
  });

  it("should include all member fields in response", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: "test-fields-001",
      email: "fields@example.com",
      name: "Fields Test",
      createdAt: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
      
      slug: "fields-test",
    });

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    const member = result.members[0];
    expect(member.uid).toBe("test-fields-001");
    expect(member.email).toBe("fields@example.com");
    expect(member.name).toBe("Fields Test");
    expect(member.membershipActive).toBe(true);
    expect(member.slug).toBe("fields-test");
    expect(member.createdAt).toBeDefined();

    await cleanupAdminListMembers();
  });

  it("should include members with missing optional fields", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: "test-minimal-001",
      email: "minimal@example.com",
      createdAt: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: false,
      
    });

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    const member = result.members[0];
    expect(member.uid).toBe("test-minimal-001");
    expect(member.email).toBe("minimal@example.com");
    expect(member.name).toBeUndefined();
    expect(member.slug).toBeUndefined();

    await cleanupAdminListMembers();
  });

  it("should handle offset beyond total members", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: "test-beyond-001",
      email: "test@example.com",
      name: "Test User",
      createdAt: Timestamp.fromDate(new Date("2024-01-15")),
    });

    // Act
    const result = await handleListMembers(
      { offset: 100 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members).toEqual([]);
    expect(result.total).toBe(1);

    await cleanupAdminListMembers();
  });

  it("should include both active and inactive members", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: "test-status-active",
      email: "active@example.com",
      name: "Active User",
      createdAt: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
    });

    await createMemberDocument({
      firestore,
      uid: "test-status-inactive",
      email: "inactive@example.com",
      name: "Inactive User",
      createdAt: Timestamp.fromDate(new Date("2024-01-10")),
      membershipActive: false,
    });

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.members.length).toBe(2);
    expect(result.total).toBe(2);
    const statuses = result.members.map(m => m.membershipActive);
    expect(statuses).toContain(true);
    expect(statuses).toContain(false);

    await cleanupAdminListMembers();
  });
});
