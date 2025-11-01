import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  AdminReadProfileRequest,
  handleAdminReadMemberProfile,
} from "../src/admin/read-member-profile";
import { MEMBERS_COLLECTION } from "../src/constants";
import { createMockCallableRequest } from "../src/test-utils/mock-request";
import { initializeTest } from "../src/test-utils/test-setup";
import { type MemberDocument } from "../src/types/member-document";

// Mock the octokit module
const mockGetContent = mock();
const mockGetInstallationOctokit =
  mock<() => { rest: { repos: { getContent: typeof mockGetContent } } }>();

void mock.module("octokit", () => ({
  App: class MockApp {
    getInstallationOctokit() {
      return mockGetInstallationOctokit();
    }
  },
}));

const test = initializeTest();

// GitHub secrets for the handler
const GITHUB_SECRETS = ["123456", "fake-private-key", "78910"];

function setup({
  testUid = "test-admin-read-001",
  testEmail = "testadminread001@example.com",
  slug = "test-admin-doula",
  membershipActive = true,
  hasProfile = true,
  adminUid = "admin-user-001",
} = {}) {
  const firestore = getFirestore();

  return {
    testUid,
    testEmail,
    slug,
    membershipActive,
    hasProfile,
    adminUid,
    firestore,
  };
}

async function createMemberDocument({
  firestore,
  uid,
  email,
  slug,
  membershipActive = true,
  hasProfile = true,
  includeSlug = true,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  slug?: string;
  membershipActive?: boolean;
  hasProfile?: boolean;
  includeSlug?: boolean;
}) {
  const memberData: MemberDocument = {
    createdAt: Timestamp.now(),
    email,
    uid,
    name: "Test Doula",
    subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    membershipActive,
    membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
    hasProfile,
    ...(includeSlug && slug ? { slug } : {}),
  };

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);

  return memberData;
}

async function cleanupAdminReadProfile() {
  const firestore = getFirestore();

  // Clean up test members
  const testDocuments = await firestore
    .collection(MEMBERS_COLLECTION)
    .where("uid", ">=", "test-")
    .where("uid", "<", "test-\uF8FF")
    .get();

  const deletePromises = testDocuments.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

function setupGitHubMock({
  markdownContent = "# Test Profile\n\nThis is a test profile.",
  imageExists = true,
  shouldThrowError = false,
}: {
  markdownContent?: string;
  imageExists?: boolean;
  shouldThrowError?: boolean;
} = {}) {
  mockGetContent.mockImplementation(
    ({ path }: { owner: string; repo: string; path: string }) => {
      if (shouldThrowError) {
        throw new Error("GitHub API error");
      }

      // Check if this is an image request
      if (path.endsWith(".avif")) {
        if (imageExists) {
          return {
            data: {
              content: Buffer.from("fake-image-data").toString("base64"),
            },
          };
        }
        throw new Error("Not Found");
      }

      // Markdown file request
      return {
        data: {
          content: Buffer.from(markdownContent).toString("base64"),
        },
      };
    },
  );

  mockGetInstallationOctokit.mockReturnValue({
    rest: {
      repos: {
        getContent: mockGetContent,
      },
    },
  });
}

describe("adminReadMemberProfile", () => {
  beforeEach(() => {
    mockGetContent.mockReset();
    mockGetInstallationOctokit.mockReset();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange & Act & Assert
    try {
      await handleAdminReadMemberProfile(
        { uid: "some-uid" },
        createMockCallableRequest(),
        GITHUB_SECRETS,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Must be authenticated to call this function",
      );
    }

    await cleanupAdminReadProfile();
  });

  it("should return permission-denied error when user is not admin", async () => {
    // Arrange & Act & Assert
    try {
      await handleAdminReadMemberProfile(
        { uid: "some-uid" },
        createMockCallableRequest({ uid: "non-admin-user" }),
        GITHUB_SECRETS,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("requires admin privileges");
    }

    await cleanupAdminReadProfile();
  });

  it("should return invalid-argument error when uid is missing", async () => {
    // Arrange
    const { adminUid } = setup();

    // Act & Assert
    try {
      await handleAdminReadMemberProfile(
        {} as AdminReadProfileRequest,
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        GITHUB_SECRETS,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("uid is required");
    }

    await cleanupAdminReadProfile();
  });

  it("should return not-found error when member document does not exist", async () => {
    // Arrange
    const { testUid, adminUid } = setup();

    // Act & Assert
    try {
      await handleAdminReadMemberProfile(
        { uid: testUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        GITHUB_SECRETS,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("No member document found for this user");
    }

    await cleanupAdminReadProfile();
  });

  it("should return failed-precondition error when user does not have a profile", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup({
      hasProfile: false,
    });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      hasProfile: false,
    });

    // Act & Assert
    try {
      await handleAdminReadMemberProfile(
        { uid: testUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        GITHUB_SECRETS,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("User does not have a profile yet");
    }

    await cleanupAdminReadProfile();
  });

  it("should return failed-precondition error when slug is missing", async () => {
    // Arrange
    const { testUid, testEmail, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug: undefined,
      includeSlug: false,
    });

    // Act & Assert
    try {
      await handleAdminReadMemberProfile(
        { uid: testUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        GITHUB_SECRETS,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("User has profile flag but no slug");
    }

    await cleanupAdminReadProfile();
  });

  it("should allow admin to read profile regardless of membership status", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup({
      membershipActive: false,
    });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      membershipActive: false,
    });

    const expectedContent =
      "# Inactive Member Profile\n\nThis profile exists but membership is inactive.";
    setupGitHubMock({ markdownContent: expectedContent });

    // Act
    const result = await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(result.content).toBe(expectedContent);
    expect(result.slug).toBe(slug);

    await cleanupAdminReadProfile();
  });

  it("should return profile content and slug when successful", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const expectedContent = "# Admin Test Profile\n\nThis is an admin test.";
    setupGitHubMock({ markdownContent: expectedContent });

    // Act
    const result = await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(result.content).toBe(expectedContent);
    expect(result.slug).toBe(slug);

    await cleanupAdminReadProfile();
  });

  it("should return image URL when image exists", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ imageExists: true });

    // Act
    const result = await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(result.image).toContain("raw.githubusercontent.com");
    expect(result.image).toContain(slug);
    expect(result.image).toContain(".avif");

    await cleanupAdminReadProfile();
  });

  it("should return undefined image when image does not exist", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ imageExists: false });

    // Act
    const result = await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(result.image).toBeUndefined();

    await cleanupAdminReadProfile();
  });

  it("should call GitHub API with correct file path", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `hugo/content/doulas/${slug}/index.md`,
      }),
    );

    await cleanupAdminReadProfile();
  });

  it("should throw internal error when GitHub API fails", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ shouldThrowError: true });

    // Act & Assert
    try {
      await handleAdminReadMemberProfile(
        { uid: testUid },
        createMockCallableRequest({ uid: adminUid, isAdmin: true }),
        GITHUB_SECRETS,
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Failed to read the profile from GitHub");
    }

    await cleanupAdminReadProfile();
  });

  it("should decode base64 content correctly", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const expectedContent = "# Profile with special chars: émoji 🎉";
    setupGitHubMock({ markdownContent: expectedContent });

    // Act
    const result = await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(result.content).toBe(expectedContent);

    await cleanupAdminReadProfile();
  });

  it("should construct correct GitHub raw URL for image", async () => {
    // Arrange
    const customSlug = "admin-jane-doe";
    const { testUid, testEmail, adminUid, firestore } = setup({
      slug: customSlug,
    });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug: customSlug,
    });

    setupGitHubMock({ imageExists: true });

    // Act
    const result = await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(result.image).toBe(
      `https://raw.githubusercontent.com/markgoho/doula-cooperative/refs/heads/trunk/hugo/content/doulas/${customSlug}/${customSlug}.avif`,
    );

    await cleanupAdminReadProfile();
  });

  it("should use correct GitHub repository owner and repo", async () => {
    // Arrange
    const { testUid, testEmail, slug, adminUid, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await handleAdminReadMemberProfile(
      { uid: testUid },
      createMockCallableRequest({ uid: adminUid, isAdmin: true }),
      GITHUB_SECRETS,
    );

    // Assert
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "markgoho",
        repo: "doula-cooperative",
      }),
    );

    await cleanupAdminReadProfile();
  });
});
