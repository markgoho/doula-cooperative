import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { handleSendInvitation } from "../src/admin/send-invitation.js";
import type { ProfileData } from "../src/claim-profile/index.js";
import { IMPORT_COLLECTION } from "../src/constants/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();

function setup({
  adminUid = "admin-user-001",
  testEmail = "testsendinvitation001@example.com",
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
  membershipActive,
  membershipExpiresAt,
  invitationEmailStatus,
  invitationEmailSentAt,
  hasProfile = false,
  slug = "",
}: {
  firestore: ReturnType<typeof getFirestore>;
  email: string;
  name: string;
  subscriptionStart: Timestamp;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  invitationEmailStatus?: "sent" | "failed" | "pending";
  invitationEmailSentAt?: Timestamp;
  hasProfile?: boolean;
  slug?: string;
}) {
  const profileData: ProfileData = {
    name,
    subscriptionStart,
    slug,
    hasProfile,
  };

  if (membershipActive !== undefined) {
    profileData.membershipActive = membershipActive;
  }
  if (membershipExpiresAt) {
    profileData.membershipExpiresAt = membershipExpiresAt;
  }
  if (invitationEmailStatus) {
    profileData.invitationEmailStatus = invitationEmailStatus;
  }
  if (invitationEmailSentAt) {
    profileData.invitationEmailSentAt = invitationEmailSentAt;
  }

  await firestore.collection(IMPORT_COLLECTION).doc(email).set(profileData);

  return profileData;
}

async function cleanupAdminSendInvitation() {
  const firestore = getFirestore();

  const allDocuments = await firestore.collection(IMPORT_COLLECTION).get();

  const deletePromises = allDocuments.docs.map((document) => document.ref.delete());
  await Promise.all(deletePromises);
}

describe("adminSendInvitation", () => {
  beforeEach(async () => {
    await cleanupAdminSendInvitation();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleSendInvitation(
        { email: "someone@example.com" },
        createMockCallableRequest(),
        undefined,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Must be authenticated to call this function");
    }

    await cleanupAdminSendInvitation();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleSendInvitation(
        { email: "someone@example.com" },
        createMockCallableRequest({ uid: "non-admin-user" }),
        undefined,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupAdminSendInvitation();
  });

  it("should return invalid-argument error when email is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleSendInvitation(
        { email: "" },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        undefined,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Email is required");
    }

    await cleanupAdminSendInvitation();
  });

  it("should return not-found error when unclaimed profile does not exist", async () => {
    // Arrange
    const { adminUid, testEmail } = setup();

    // Act & Assert
    try {
      await handleSendInvitation(
        { email: testEmail },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        undefined,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Unclaimed profile with email");
      expect(String(error)).toContain("not found");
    }

    await cleanupAdminSendInvitation();
  });

  it("should return failed-precondition error when profile has no subscription data", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    // Create profile without subscriptionStart
    await firestore.collection(IMPORT_COLLECTION).doc(testEmail).set({
      name: "No Subscription Profile",
      slug: "",
      hasProfile: false,
      // Missing subscriptionStart
    });

    // Act & Assert
    try {
      await handleSendInvitation(
        { email: testEmail },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        undefined,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("missing required data");
    }

    await cleanupAdminSendInvitation();
  });

  it("should successfully send invitation with complete profile data", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Test Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
    });

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    // Verify profile document was updated with invitation tracking
    const profileDocument = await firestore.collection(IMPORT_COLLECTION).doc(testEmail).get();
    const profileData = profileDocument.data() as ProfileData;

    expect(profileData.invitationEmailStatus).toBe("sent");
    expect(profileData.invitationEmailSentAt).toBeDefined();

    await cleanupAdminSendInvitation();
  });

  it("should successfully send invitation without membershipExpiresAt", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Test Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      // No membershipExpiresAt provided
    });

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    // Verify profile document was updated
    const profileDocument = await firestore.collection(IMPORT_COLLECTION).doc(testEmail).get();
    const profileData = profileDocument.data() as ProfileData;

    expect(profileData.invitationEmailStatus).toBe("sent");

    await cleanupAdminSendInvitation();
  });

  it("should send invitation to inactive profiles", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Inactive Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: false,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
    });

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    await cleanupAdminSendInvitation();
  });

  it("should update invitation status even if already sent before", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Previously Invited Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
      invitationEmailStatus: "sent",
      invitationEmailSentAt: Timestamp.fromDate(new Date("2024-01-20")),
    });

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    // Verify the timestamp was updated
    const profileDocument = await firestore.collection(IMPORT_COLLECTION).doc(testEmail).get();
    const profileData = profileDocument.data() as ProfileData;

    expect(profileData.invitationEmailStatus).toBe("sent");
    expect(profileData.invitationEmailSentAt).toBeDefined();
    // The new timestamp should be more recent than the old one
    const oldTimestamp = Timestamp.fromDate(new Date("2024-01-20"));
    const sentAt = profileData.invitationEmailSentAt;
    if (sentAt) {
      expect(sentAt.toMillis()).toBeGreaterThan(oldTimestamp.toMillis());
    }

    await cleanupAdminSendInvitation();
  });

  it("should handle profiles with expired subscriptions", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Expired Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2023-01-15")),
      membershipActive: false,
      membershipExpiresAt: Timestamp.fromDate(new Date("2024-01-31")), // In the past
    });

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    await cleanupAdminSendInvitation();
  });

  it("should clear previous invitation error on successful send", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Previously Failed Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
    });

    // Set initial error state
    await firestore.collection(IMPORT_COLLECTION).doc(testEmail).update({
      invitationEmailStatus: "failed",
      invitationEmailError: "Previous error message",
    });

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    // Verify error was cleared
    const profileDocument = await firestore.collection(IMPORT_COLLECTION).doc(testEmail).get();
    const profileData = profileDocument.data() as ProfileData;

    expect(profileData.invitationEmailStatus).toBe("sent");
    expect(profileData.invitationEmailError).toBeUndefined();

    await cleanupAdminSendInvitation();
  });

  it("should work with future subscription dates", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    await createUnclaimedProfile({
      firestore,
      email: testEmail,
      name: "Future Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
      membershipExpiresAt: Timestamp.fromDate(futureDate),
    });

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    await cleanupAdminSendInvitation();
  });

  it("should preserve other profile fields when updating invitation status", async () => {
    // Arrange
    const { adminUid, testEmail, firestore } = setup();

    const profileData: ProfileData = {
      name: "Complete Profile",
      subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
      membershipActive: true,
      membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
      hasProfile: true,
      slug: "complete-profile",
    };

    await firestore.collection(IMPORT_COLLECTION).doc(testEmail).set(profileData);

    // Act
    const result = await handleSendInvitation(
      { email: testEmail },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      undefined,
    );

    // Assert
    expect(result.success).toBe(true);

    // Verify all other fields were preserved
    const updatedProfileDocument = await firestore.collection(IMPORT_COLLECTION).doc(testEmail).get();
    const updatedProfileData = updatedProfileDocument.data() as ProfileData;

    expect(updatedProfileData.name).toBe("Complete Profile");
    expect(updatedProfileData.hasProfile).toBe(true);
    expect(updatedProfileData.slug).toBe("complete-profile");
    expect(updatedProfileData.invitationEmailStatus).toBe("sent");

    await cleanupAdminSendInvitation();
  });
});
