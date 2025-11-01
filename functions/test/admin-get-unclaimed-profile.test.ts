import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleGetUnclaimedProfile } from "../src/admin/get-unclaimed-profile";
import { IMPORT_COLLECTION } from "../src/constants";
import { createMockCallableRequest } from "../src/test-utils/mock-request";
import { initializeTest } from "../src/test-utils/test-setup";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  testEmail = "testunclaimed@example.com",
} = {}) {
  const firestore = getFirestore();

  return {
    adminUid,
    testEmail,
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

async function cleanupAdminGetUnclaimedProfile() {
  const firestore = getFirestore();

  const allDocuments = await firestore
    .collection(IMPORT_COLLECTION)
    .get();

  const deletePromises = allDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("adminGetUnclaimedProfile", () => {
  beforeEach(async () => {
    await cleanupAdminGetUnclaimedProfile();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleGetUnclaimedProfile(
        { email: "some@example.com" },
        createMockCallableRequest(),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleGetUnclaimedProfile(
        { email: "some@example.com" },
        createMockCallableRequest({ uid: "non-admin-user" }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should return invalid-argument error when email is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleGetUnclaimedProfile(
        { email: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Email is required");
    }

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should return not-found error when profile does not exist", async () => {
    // Arrange
    const { adminUid, testEmail } = setup();

    // Act & Assert
    try {
      await handleGetUnclaimedProfile(
        { email: testEmail },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Unclaimed profile with email");
      expect(String(error)).toContain("not found");
    }

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should return profile data when profile exists", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Test Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      hasProfile: false,
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.email).toBe(testEmail);
    expect(result.name).toBe("Test Profile");
    expect(result.hasProfile).toBe(false);

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should return profile with all fields populated", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Full Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      hasProfile: true,
      membershipActive: true,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-15")),
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.email).toBe(testEmail);
    expect(result.name).toBe("Full Profile");
    expect(result.hasProfile).toBe(true);
    expect(result.membershipActive).toBe(true);
    expect(result.subscriptionStart).toBeDefined();
    expect(result.membershipExpiresAt).toBeDefined();

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should return profile with minimal fields", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Minimal Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      hasProfile: false,
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.email).toBe(testEmail);
    expect(result.name).toBe("Minimal Profile");
    expect(result.hasProfile).toBe(false);
    expect(result.membershipActive).toBeUndefined();
    expect(result.membershipExpiresAt).toBeUndefined();

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should work with profiles that have hasProfile true", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Has Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      hasProfile: true,
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.hasProfile).toBe(true);

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should handle email addresses with special characters", async () => {
    // Arrange
    const { adminUid, firestore } = setup();
    const specialEmail = "test+special.name@example.com";

    await createUnclaimedProfile({
      firestore,
      email: specialEmail,
      name: "Special Email Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: specialEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.email).toBe(specialEmail);

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should preserve all timestamp fields", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();
    const subscriptionStart = Timestamp.fromDate(new Date("2024-01-15T10:30:00Z"));
    const membershipExpiresAt = Timestamp.fromDate(new Date("2025-01-15T10:30:00Z"));

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Timestamp Profile",
      subscriptionStart,
      membershipExpiresAt,
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.subscriptionStart).toEqual(subscriptionStart);
    expect(result.membershipExpiresAt).toEqual(membershipExpiresAt);

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should work with profiles that have membershipActive false", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Inactive Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: false,
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.membershipActive).toBe(false);

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should work with profiles that have membershipActive true", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Active Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.membershipActive).toBe(true);

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should handle names with special characters", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "O'Brien-Smith & Jones",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert
    expect(result.name).toBe("O'Brien-Smith & Jones");

    await cleanupAdminGetUnclaimedProfile();
  });

  it("should return correct email as document ID", async () => {
    // Arrange
    const { adminUid, firestore } = setup();
    const email1 = "first@example.com";
    const email2 = "second@example.com";

    await createUnclaimedProfile({
      firestore,
      email: email1,
      name: "First Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    });

    await createUnclaimedProfile({
      firestore,
      email: email2,
      name: "Second Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    });

    // Act
    const result = await handleGetUnclaimedProfile(
      { email: email1 },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
    );

    // Assert - should get the correct profile
    expect(result.email).toBe(email1);
    expect(result.name).toBe("First Profile");

    await cleanupAdminGetUnclaimedProfile();
  });
});
