import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readProfile } from "../src";
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

function setup({
  testUid = "test-read-001",
  testEmail = "testread001@example.com",
  slug = "test-doula-read",
  membershipActive = true,
  hasProfile = true,
} = {}) {
  const wrappedReadProfile = test.wrap(readProfile);
  const firestore = getFirestore();

  // Set up environment variables for GitHub secrets
  process.env.GITHUB_APP_ID = "123456";
  process.env.GITHUB_PRIVATE_KEY = "fake-private-key";
  process.env.GITHUB_INSTALLATION_ID = "78910";

  return {
    testUid,
    testEmail,
    slug,
    membershipActive,
    hasProfile,
    wrappedReadProfile,
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

async function cleanupReadProfile() {
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

describe("readProfile", () => {
  beforeEach(() => {
    mockGetContent.mockReset();
    mockGetInstallationOctokit.mockReset();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange
    const { wrappedReadProfile } = setup();

    // Act & Assert
    try {
      await wrappedReadProfile(createMockCallableRequest());
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "The function must be called while authenticated",
      );
    }

    await cleanupReadProfile();
  });

  it("should return not-found error when member document does not exist", async () => {
    // Arrange
    const { testUid, wrappedReadProfile } = setup();

    // Act & Assert
    try {
      await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("No member document found for this user");
    }

    await cleanupReadProfile();
  });

  it("should return failed-precondition error when membership is not active", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup({
      membershipActive: false,
    });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      membershipActive: false,
    });

    // Act & Assert
    try {
      await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "User does not have an active membership",
      );
    }

    await cleanupReadProfile();
  });

  it("should return failed-precondition error when user does not have a profile", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup({
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
      await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("User does not have a profile yet");
    }

    await cleanupReadProfile();
  });

  it("should return not-found error when slug is missing", async () => {
    // Arrange
    const { testUid, testEmail, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug: undefined,
      includeSlug: false,
    });

    // Act & Assert
    try {
      await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Profile not found");
    }

    await cleanupReadProfile();
  });

  it("should return profile content when successful", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const expectedContent = "# Test Profile\n\nThis is a test.";
    setupGitHubMock({ markdownContent: expectedContent });

    // Act
    const result = await wrappedReadProfile(
      createMockCallableRequest({ uid: testUid }),
    );

    // Assert
    expect(result.content).toBe(expectedContent);

    await cleanupReadProfile();
  });

  it("should return image URL when image exists", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ imageExists: true });

    // Act
    const result = await wrappedReadProfile(
      createMockCallableRequest({ uid: testUid }),
    );

    // Assert
    expect(result.image).toContain("raw.githubusercontent.com");
    expect(result.image).toContain(slug);
    expect(result.image).toContain(".avif");

    await cleanupReadProfile();
  });

  it("should return undefined image when image does not exist", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ imageExists: false });

    // Act
    const result = await wrappedReadProfile(
      createMockCallableRequest({ uid: testUid }),
    );

    // Assert
    expect(result.image).toBeUndefined();

    await cleanupReadProfile();
  });

  it("should call GitHub API with correct file path", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));

    // Assert
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `hugo/content/doulas/${slug}/index.md`,
      }),
    );

    await cleanupReadProfile();
  });

  it("should call GitHub API with correct image path", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ imageExists: true });

    // Act
    await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));

    // Assert
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `hugo/content/doulas/${slug}/${slug}.avif`,
      }),
    );

    await cleanupReadProfile();
  });

  it("should throw internal error when GitHub API fails", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ shouldThrowError: true });

    // Act & Assert
    try {
      await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Failed to read the file from GitHub");
    }

    await cleanupReadProfile();
  });

  it("should decode base64 content correctly", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const expectedContent = "# Profile with special chars: émoji 🎉";
    setupGitHubMock({ markdownContent: expectedContent });

    // Act
    const result = await wrappedReadProfile(
      createMockCallableRequest({ uid: testUid }),
    );

    // Assert
    expect(result.content).toBe(expectedContent);

    await cleanupReadProfile();
  });

  it("should return failed-precondition when membershipActive is undefined", async () => {
    // Arrange
    const { testUid, testEmail, wrappedReadProfile, firestore } = setup();

    // Create a document with membershipActive explicitly undefined (empty object behavior)
    await firestore.collection(MEMBERS_COLLECTION).doc(testUid).set({
      createdAt: Timestamp.now(),
      email: testEmail,
      uid: testUid,
      // membershipActive is not set (undefined)
    });

    // Act & Assert
    try {
      await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "User does not have an active membership",
      );
    }

    await cleanupReadProfile();
  });

  it("should construct correct GitHub raw URL for image", async () => {
    // Arrange
    const customSlug = "jane-doe-doula";
    const { testUid, testEmail, wrappedReadProfile, firestore } = setup({
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
    const result = await wrappedReadProfile(
      createMockCallableRequest({ uid: testUid }),
    );

    // Assert
    expect(result.image).toBe(
      `https://raw.githubusercontent.com/markgoho/doula-cooperative/refs/heads/trunk/hugo/content/doulas/${customSlug}/${customSlug}.avif`,
    );

    await cleanupReadProfile();
  });

  it("should use correct GitHub repository owner", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedReadProfile, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedReadProfile(createMockCallableRequest({ uid: testUid }));

    // Assert
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "markgoho",
        repo: "doula-cooperative",
      }),
    );

    await cleanupReadProfile();
  });
});
