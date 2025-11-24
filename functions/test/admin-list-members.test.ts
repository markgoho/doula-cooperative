import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleListMembers } from "../src/admin/list-members.js";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../src/collections/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();

function setup({ adminUid = "admin-user-001" } = {}) {
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

  await firestore
    .collection(MEMBERS_COLLECTION)
    .doc(uid)
    .set(memberData as MemberDocument);

  return memberData as MemberDocument;
}

// Test-specific prefix for isolation
const TEST_PREFIX = "test-list-members-";

async function cleanupAdminListMembers() {
  const firestore = getFirestore();

  // Clean up ALL members to ensure clean state for list tests
  // This is necessary because listMembers queries all members, not filtered ones
  // Other tests should clean up their own data, but list tests need a clean slate
  const allDocuments = await firestore
    .collection(MEMBERS_COLLECTION)
    .listDocuments();

  if (allDocuments.length > 0) {
    const batch = firestore.batch();
    for (const document of allDocuments) {
      batch.delete(document);
    }
    await batch.commit();
  }
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
      await handleListMembers({}, createMockCallableRequest());
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
      await handleListMembers(
        {},
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }
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
  });

  it("should return all members when no pagination specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}001`,
      email: `${TEST_PREFIX}001@example.com`,
      name: "User One",
      createdAt: Timestamp.fromDate(new Date("2024-01-01")),
    });

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}002`,
      email: `${TEST_PREFIX}002@example.com`,
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
  });

  it("should order members by creation date descending", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}order-001`,
      email: "older@example.com",
      name: "Older User",
      createdAt: Timestamp.fromDate(new Date("2024-01-01")),
    });

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}order-002`,
      email: "newer@example.com",
      name: "Newer User",
      createdAt: Timestamp.fromDate(new Date("2024-01-15")),
    });

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}order-003`,
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
    const member0 = result.members[0];
    const member1 = result.members[1];
    const member2 = result.members[2];
    expect(member0).toBeDefined();
    expect(member1).toBeDefined();
    expect(member2).toBeDefined();
    if (member0 && member1 && member2) {
      expect(member0.email).toBe("newest@example.com");
      expect(member1.email).toBe("newer@example.com");
      expect(member2.email).toBe("older@example.com");
    }
  });

  it("should respect limit parameter", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 5; index++) {
      await createMemberDocument({
        firestore,
        uid: `${TEST_PREFIX}limit-${String(index).padStart(3, "0")}`,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        createdAt: Timestamp.fromDate(
          new Date(`2024-01-${String(index).padStart(2, "0")}`),
        ),
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
  });

  it("should respect offset parameter", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 5; index++) {
      await createMemberDocument({
        firestore,
        uid: `${TEST_PREFIX}offset-${String(index).padStart(3, "0")}`,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        createdAt: Timestamp.fromDate(
          new Date(`2024-01-${String(index).padStart(2, "0")}`),
        ),
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
    const member0 = result.members[0];
    expect(member0).toBeDefined();
    if (member0) {
      expect(member0.uid).toBe(`${TEST_PREFIX}offset-003`);
    }
  });

  it("should handle both limit and offset together", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 10; index++) {
      await createMemberDocument({
        firestore,
        uid: `${TEST_PREFIX}page-${String(index).padStart(3, "0")}`,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        createdAt: Timestamp.fromDate(
          new Date(`2024-01-${String(index).padStart(2, "0")}`),
        ),
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
    const pageMember0 = result.members[0];
    const pageMember1 = result.members[1];
    const pageMember2 = result.members[2];
    expect(pageMember0).toBeDefined();
    expect(pageMember1).toBeDefined();
    expect(pageMember2).toBeDefined();
    if (pageMember0 && pageMember1 && pageMember2) {
      expect(pageMember0.uid).toBe(`${TEST_PREFIX}page-007`);
      expect(pageMember1.uid).toBe(`${TEST_PREFIX}page-006`);
      expect(pageMember2.uid).toBe(`${TEST_PREFIX}page-005`);
    }
  });

  it("should use default limit of 50 when not specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    // Create 52 members
    for (let index = 1; index <= 52; index++) {
      await createMemberDocument({
        firestore,
        uid: `${TEST_PREFIX}default-${String(index).padStart(3, "0")}`,
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
  });

  it("should use default offset of 0 when not specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}default-offset-001`,
      email: "newest@example.com",
      name: "Newest User",
      createdAt: Timestamp.fromDate(new Date("2024-01-20")),
    });

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}default-offset-002`,
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
    const defaultMember0 = result.members[0];
    expect(defaultMember0).toBeDefined();
    if (defaultMember0) {
      expect(defaultMember0.email).toBe("newest@example.com");
    }
  });

  it("should include all member fields in response", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}fields-001`,
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
    expect(member).toBeDefined();
    if (member) {
      expect(member.uid).toBe(`${TEST_PREFIX}fields-001`);
      expect(member.email).toBe("fields@example.com");
      expect(member.name).toBe("Fields Test");
      expect(member.membershipActive).toBe(true);
      expect(member.slug).toBe("fields-test");
      expect(member.createdAt).toBeDefined();
    }
  });

  it("should include members with missing optional fields", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}minimal-001`,
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
    expect(member).toBeDefined();
    if (member) {
      expect(member.uid).toBe(`${TEST_PREFIX}minimal-001`);
      expect(member.email).toBe("minimal@example.com");
      expect(member.name).toBeUndefined();
      expect(member.slug).toBeUndefined();
    }
  });

  it("should handle offset beyond total members", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: `${TEST_PREFIX}beyond-001`,
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
  });

  it("should include both active and inactive members", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    const activeUid = `${TEST_PREFIX}status-active`;
    const inactiveUid = `${TEST_PREFIX}status-inactive`;

    await createMemberDocument({
      firestore,
      uid: activeUid,
      email: `${TEST_PREFIX}active@example.com`,
      name: "Active User",
      createdAt: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
    });

    await createMemberDocument({
      firestore,
      uid: inactiveUid,
      email: `${TEST_PREFIX}inactive@example.com`,
      name: "Inactive User",
      createdAt: Timestamp.fromDate(new Date("2024-01-10")),
      membershipActive: false,
    });

    // Act
    const result = await handleListMembers(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert - find our specific test members rather than checking exact count
    // This is more robust when running with other tests in parallel
    const activeMember = result.members.find(m => m.uid === activeUid);
    const inactiveMember = result.members.find(m => m.uid === inactiveUid);

    expect(activeMember).toBeDefined();
    expect(inactiveMember).toBeDefined();
    if (activeMember) {
      expect(activeMember.membershipActive).toBe(true);
    }
    if (inactiveMember) {
      expect(inactiveMember.membershipActive).toBe(false);
    }

    // Verify both statuses are present in results
    const statuses = result.members.map(m => m.membershipActive);
    expect(statuses).toContain(true);
    expect(statuses).toContain(false);
  });
});
