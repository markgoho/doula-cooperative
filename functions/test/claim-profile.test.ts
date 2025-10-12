import { afterAll, describe, expect, it } from "bun:test";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { claimProfile } from "../src";
import { type ProfileData } from "../src/claim-profile";
import {
  cleanupTestMembers,
  getMemberData,
  getMemberDocument,
} from "../src/test-utils/firestore-helpers";
import {
  IMPORT_COLLECTION,
  initializeTest,
} from "../src/test-utils/test-setup";

const test = initializeTest();

// Helper to create a mock CallableRequest for testing
function createMockRequest({
  data,
  uid,
  email,
  emailVerified = true,
}: {
  data?: unknown;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
} = {}): CallableRequest {
  return {
    data,
    auth: uid
      ? {
          uid,
          token: {
            email,
            email_verified: emailVerified,
          },
        }
      : undefined,
    rawRequest: {} as CallableRequest["rawRequest"],
    acceptsStreaming: false,
  } as CallableRequest;
}

function setup({
  testUid = "test-claim-001",
  testEmail = "testclaim001@example.com",
  emailVerified = true,
  withImportDocument = true,
} = {}) {
  const wrappedClaimProfile = test.wrap(claimProfile);
  const firestore = getFirestore();

  return {
    testUid,
    testEmail,
    emailVerified,
    wrappedClaimProfile,
    firestore,
    withImportDocument,
  };
}

async function createImportDocument({
  firestore,
  email,
  profileData,
}: {
  firestore: ReturnType<typeof getFirestore>;
  email: string;
  profileData?: Partial<ProfileData>;
}) {
  const defaultProfileData: ProfileData = {
    name: "Test Doula",
    subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    slug: "test-doula",
    hasProfile: true,
  };

  const data = { ...defaultProfileData, ...profileData };

  await firestore.collection(IMPORT_COLLECTION).doc(email).set(data);

  return data;
}

async function getImportDocument({
  firestore,
  email,
}: {
  firestore: ReturnType<typeof getFirestore>;
  email: string;
}) {
  return firestore.collection(IMPORT_COLLECTION).doc(email).get();
}

async function cleanupClaimProfile() {
  const firestore = getFirestore();

  // Clean up test members
  await cleanupTestMembers({ firestore });

  // Clean up test import documents
  const testImports = await firestore.collection(IMPORT_COLLECTION).get();
  const deleteImportPromises = testImports.docs
    .filter(importDocument => importDocument.id.includes("testclaim"))
    .map(document => document.ref.delete());

  await Promise.all(deleteImportPromises);

  // Clean up test auth users
  const auth = getAuth();
  try {
    const users = await auth.listUsers();
    const deleteAuthPromises = users.users
      .filter(user => user.uid.startsWith("test-"))
      .map(user => auth.deleteUser(user.uid));
    await Promise.all(deleteAuthPromises);
  } catch {
    // Auth cleanup may fail in emulator, that's okay
  }
}

describe("claimProfile", () => {
  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange
    const { wrappedClaimProfile } = setup();

    // Act & Assert
    try {
      await wrappedClaimProfile(createMockRequest());
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "The function must be called while authenticated",
      );
    }

    await cleanupClaimProfile();
  });

  it("should return failed-precondition error when email is not verified", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile } = setup({
      emailVerified: false,
    });

    // Act & Assert
    try {
      await wrappedClaimProfile(
        createMockRequest({
          uid: testUid,
          email: testEmail,
          emailVerified: false,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "The user must have a verified email to claim a profile",
      );
    }

    await cleanupClaimProfile();
  });

  it("should return no_profile_to_claim when import document does not exist", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile } = setup({
      withImportDocument: false,
    });

    // Act
    const result = await wrappedClaimProfile(
      createMockRequest({ uid: testUid, email: testEmail }),
    );

    // Assert
    expect(result.status).toBe("no_profile_to_claim");

    await cleanupClaimProfile();
  });

  it("should return success status when claiming profile", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    await createImportDocument({ firestore, email: testEmail });

    // Act
    const result = await wrappedClaimProfile(
      createMockRequest({ uid: testUid, email: testEmail }),
    );

    // Assert
    expect(result.status).toBe("success");

    await cleanupClaimProfile();
  });

  it("should create member document when claiming profile", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    await createImportDocument({ firestore, email: testEmail });

    // Act
    await wrappedClaimProfile(
      createMockRequest({
        data: undefined,
        uid: testUid,
        email: testEmail,
      }),
    );

    // Assert
    const memberDocument = await getMemberDocument({ firestore, uid: testUid });
    expect(memberDocument.exists).toBe(true);

    await cleanupClaimProfile();
  });

  it("should set membershipActive to true", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    await createImportDocument({ firestore, email: testEmail });

    // Act
    await wrappedClaimProfile(
      createMockRequest({
        data: undefined,
        uid: testUid,
        email: testEmail,
      }),
    );

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.membershipActive).toBe(true);

    await cleanupClaimProfile();
  });

  it("should set membershipExpiresAt to last day of subscription month", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    const subscriptionStart = Timestamp.fromDate(new Date("2024-03-15"));
    await createImportDocument({
      firestore,
      email: testEmail,
      profileData: { subscriptionStart },
    });

    // Act
    await wrappedClaimProfile(
      createMockRequest({
        data: undefined,
        uid: testUid,
        email: testEmail,
      }),
    );

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    const expirationDate = data?.membershipExpiresAt?.toDate();
    expect(expirationDate?.getDate()).toBe(31); // Last day of March

    await cleanupClaimProfile();
  });

  it("should set membershipExpiresAt to correct month", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    const subscriptionStart = Timestamp.fromDate(new Date("2024-03-15"));
    await createImportDocument({
      firestore,
      email: testEmail,
      profileData: { subscriptionStart },
    });

    // Act
    await wrappedClaimProfile(
      createMockRequest({
        data: undefined,
        uid: testUid,
        email: testEmail,
      }),
    );

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    const expirationDate = data?.membershipExpiresAt?.toDate();
    expect(expirationDate?.getMonth()).toBe(2); // March (0-indexed)

    await cleanupClaimProfile();
  });

  it("should preserve subscriptionStart value from import document", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    const subscriptionStart = Timestamp.fromDate(new Date("2024-01-15"));
    await createImportDocument({
      firestore,
      email: testEmail,
      profileData: { subscriptionStart },
    });

    // Act
    await wrappedClaimProfile(
      createMockRequest({
        data: undefined,
        uid: testUid,
        email: testEmail,
      }),
    );

    // Assert
    const data = await getMemberData({ firestore, uid: testUid });
    expect(data?.subscriptionStart?.toMillis()).toBe(
      subscriptionStart.toMillis(),
    );

    await cleanupClaimProfile();
  });

  it("should delete import document after successful claim", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    await createImportDocument({ firestore, email: testEmail });

    // Act
    await wrappedClaimProfile(
      createMockRequest({
        data: undefined,
        uid: testUid,
        email: testEmail,
      }),
    );

    // Assert
    const afterClaim = await getImportDocument({ firestore, email: testEmail });
    expect(afterClaim.exists).toBe(false);

    await cleanupClaimProfile();
  });

  it("should return profile name in response data", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    const profileData = await createImportDocument({
      firestore,
      email: testEmail,
    });

    // Act
    const result = await wrappedClaimProfile(
      createMockRequest({ uid: testUid, email: testEmail }),
    );

    // Assert
    expect(result.data?.name).toBe(profileData.name);

    await cleanupClaimProfile();
  });

  it("should return profile slug in response data", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    const profileData = await createImportDocument({
      firestore,
      email: testEmail,
    });

    // Act
    const result = await wrappedClaimProfile(
      createMockRequest({ uid: testUid, email: testEmail }),
    );

    // Assert
    expect(result.data?.slug).toBe(profileData.slug);

    await cleanupClaimProfile();
  });

  it("should return profile hasProfile in response data", async () => {
    // Arrange
    const { testUid, testEmail, wrappedClaimProfile, firestore } = setup();

    const profileData = await createImportDocument({
      firestore,
      email: testEmail,
    });

    // Act
    const result = await wrappedClaimProfile(
      createMockRequest({ uid: testUid, email: testEmail }),
    );

    // Assert
    expect(result.data?.hasProfile).toBe(profileData.hasProfile);

    await cleanupClaimProfile();
  });
});
