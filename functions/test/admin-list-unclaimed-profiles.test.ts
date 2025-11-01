import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleListUnclaimedProfiles } from "../src/admin/list-unclaimed-profiles";
import { IMPORT_COLLECTION } from "../src/constants";
import { createMockCallableRequest } from "../src/test-utils/mock-request";
import { initializeTest } from "../src/test-utils/test-setup";

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

async function createUnclaimedProfile({
  firestore,
  email,
  name,
  subscriptionStart,
  hasProfile = false,
  membershipActive,
  membershipExpiresAt,
}: {
  firestore: ReturnType<typeof getFirestore>;
  email: string;
  name: string;
  subscriptionStart: Timestamp;
  hasProfile?: boolean;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
}) {
  const profileData: {
    name: string;
    subscriptionStart: Timestamp;
    hasProfile?: boolean;
    membershipActive?: boolean;
    membershipExpiresAt?: Timestamp;
  } = {
    name,
    subscriptionStart,
    hasProfile,
  };

  if (membershipActive !== undefined) {
    profileData.membershipActive = membershipActive;
  }
  if (membershipExpiresAt) {
    profileData.membershipExpiresAt = membershipExpiresAt;
  }

  await firestore.collection(IMPORT_COLLECTION).doc(email).set(profileData);

  return profileData;
}

async function cleanupAdminListUnclaimedProfiles() {
  const firestore = getFirestore();

  const allDocuments = await firestore
    .collection(IMPORT_COLLECTION)
    .get();

  const deletePromises = allDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("adminListUnclaimedProfiles", () => {
  beforeEach(async () => {
    await cleanupAdminListUnclaimedProfiles();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleListUnclaimedProfiles(
        {},
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleListUnclaimedProfiles(
        {},
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should return empty array when no unclaimed profiles exist", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles).toEqual([]);
    expect(result.total).toBe(0);

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should return all unclaimed profiles when no pagination specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: "test001@example.com",
      name: "User One",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-01")),
    });

    await createUnclaimedProfile({
      firestore,
      email: "test002@example.com",
      name: "User Two",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-02")),
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles.length).toBe(2);
    expect(result.total).toBe(2);

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should order profiles by email (document ID)", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: "charlie@example.com",
      name: "Charlie",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-01")),
    });

    await createUnclaimedProfile({
      firestore,
      email: "alice@example.com",
      name: "Alice",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-02")),
    });

    await createUnclaimedProfile({
      firestore,
      email: "bob@example.com",
      name: "Bob",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-03")),
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert - should be ordered alphabetically by email
    expect(result.profiles[0].email).toBe("alice@example.com");
    expect(result.profiles[1].email).toBe("bob@example.com");
    expect(result.profiles[2].email).toBe("charlie@example.com");

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should respect limit parameter", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 5; index++) {
      await createUnclaimedProfile({
        firestore,
        email: `test${index}@example.com`,
        name: `User ${index}`,
        subscriptionStart: Timestamp.fromDate(new Date(`2024-01-${String(index).padStart(2, "0")}`)),
      });
    }

    // Act
    const result = await handleListUnclaimedProfiles(
      { limit: 3 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles.length).toBe(3);
    expect(result.total).toBe(5);

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should respect offset parameter", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 5; index++) {
      await createUnclaimedProfile({
        firestore,
        email: `user${index}@example.com`,
        name: `User ${index}`,
        subscriptionStart: Timestamp.fromDate(new Date(`2024-01-${String(index).padStart(2, "0")}`)),
      });
    }

    // Act
    const result = await handleListUnclaimedProfiles(
      { offset: 2 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles.length).toBe(3);
    expect(result.total).toBe(5);
    // Should skip first 2 (user1, user2), so first result should be user3
    expect(result.profiles[0].email).toBe("user3@example.com");

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should handle both limit and offset together", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    for (let index = 1; index <= 10; index++) {
      await createUnclaimedProfile({
        firestore,
        email: `user${String(index).padStart(2, "0")}@example.com`,
        name: `User ${index}`,
        subscriptionStart: Timestamp.fromDate(new Date(`2024-01-${String(index).padStart(2, "0")}`)),
      });
    }

    // Act - Get second page of 3 items
    const result = await handleListUnclaimedProfiles(
      { limit: 3, offset: 3 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles.length).toBe(3);
    expect(result.total).toBe(10);
    // Should get items 4-6 (user04, user05, user06)
    expect(result.profiles[0].email).toBe("user04@example.com");
    expect(result.profiles[1].email).toBe("user05@example.com");
    expect(result.profiles[2].email).toBe("user06@example.com");

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should use default limit of 50 when not specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    // Create 52 profiles
    for (let index = 1; index <= 52; index++) {
      await createUnclaimedProfile({
        firestore,
        email: `test${String(index).padStart(3, "0")}@example.com`,
        name: `User ${index}`,
        subscriptionStart: Timestamp.fromDate(new Date("2024-01-01")),
      });
    }

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert - should only get 50 (default limit)
    expect(result.profiles.length).toBe(50);
    expect(result.total).toBe(52);

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should use default offset of 0 when not specified", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: "aaa@example.com",
      name: "First Alphabetically",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-20")),
    });

    await createUnclaimedProfile({
      firestore,
      email: "zzz@example.com",
      name: "Last Alphabetically",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-10")),
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert - should start from beginning (first alphabetically)
    expect(result.profiles[0].email).toBe("aaa@example.com");

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should include all profile fields in response", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: "fields@example.com",
      name: "Fields Test",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      hasProfile: true,
      membershipActive: true,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-15")),
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    const profile = result.profiles[0];
    expect(profile.email).toBe("fields@example.com");
    expect(profile.name).toBe("Fields Test");
    expect(profile.hasProfile).toBe(true);
    expect(profile.membershipActive).toBe(true);
    expect(profile.subscriptionStart).toBeDefined();
    expect(profile.membershipExpiresAt).toBeDefined();

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should include profiles with missing optional fields", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: "minimal@example.com",
      name: "Minimal Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      hasProfile: false,
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    const profile = result.profiles[0];
    expect(profile.email).toBe("minimal@example.com");
    expect(profile.name).toBe("Minimal Profile");
    expect(profile.hasProfile).toBe(false);
    expect(profile.membershipActive).toBeUndefined();
    expect(profile.membershipExpiresAt).toBeUndefined();

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should handle offset beyond total profiles", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: "test@example.com",
      name: "Test User",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      { offset: 100 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles).toEqual([]);
    expect(result.total).toBe(1);

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should include profiles with and without profiles", async () => {
    // Arrange
    const { adminUid, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: "with-profile@example.com",
      name: "Has Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      hasProfile: true,
    });

    await createUnclaimedProfile({
      firestore,
      email: "without-profile@example.com",
      name: "No Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-10")),
      hasProfile: false,
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles.length).toBe(2);
    expect(result.total).toBe(2);
    const hasProfileStatuses = result.profiles.map(p => p.hasProfile);
    expect(hasProfileStatuses).toContain(true);
    expect(hasProfileStatuses).toContain(false);

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should preserve subscription start timestamp", async () => {
    // Arrange
    const { adminUid, firestore } = setup();
    const subscriptionStart = Timestamp.fromDate(new Date("2024-01-15T10:30:00Z"));

    await createUnclaimedProfile({
      firestore,
      email: "timestamp@example.com",
      name: "Timestamp Test",
      subscriptionStart,
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles[0].subscriptionStart).toEqual(subscriptionStart);

    await cleanupAdminListUnclaimedProfiles();
  });

  it("should handle email addresses with special characters", async () => {
    // Arrange
    const { adminUid, firestore } = setup();
    const specialEmail = "test+special.name@example.com";

    await createUnclaimedProfile({
      firestore,
      email: specialEmail,
      name: "Special Email",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    });

    // Act
    const result = await handleListUnclaimedProfiles(
      {},
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.profiles[0].email).toBe(specialEmail);

    await cleanupAdminListUnclaimedProfiles();
  });
});
