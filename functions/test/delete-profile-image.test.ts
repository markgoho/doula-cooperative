import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../src/collections/index.js";
import { deleteProfileImage } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";
import { type MemberDocument } from "../src/types/member-document.js";

// Mock the octokit module
const mockGetContent = mock();
const mockDeleteFile = mock();
const mockGetInstallationOctokit = mock<
  () => {
    rest: {
      repos: {
        getContent: typeof mockGetContent;
        deleteFile: typeof mockDeleteFile;
      };
    };
  }
>();

void mock.module("octokit", () => ({
  App: class MockApp {
    getInstallationOctokit() {
      return mockGetInstallationOctokit();
    }
  },
}));

const test = initializeTest();

interface SetupOptions {
  testUid?: string;
  testEmail?: string;
  slug?: string;
  membershipActive?: boolean;
}

function setup({
  testUid = "test-delete-001",
  testEmail = "testdelete001@example.com",
  slug = "test-doula-delete",
  membershipActive = true,
}: SetupOptions = {}) {
  const wrappedDeleteProfileImage = test.wrap(deleteProfileImage);
  const firestore = getFirestore();

  // Set up environment variables for GitHub secrets
  process.env["GITHUB_APP_ID"] = "123456";
  process.env["GITHUB_PRIVATE_KEY"] = "fake-private-key";
  process.env["GITHUB_INSTALLATION_ID"] = "78910";

  return {
    testUid,
    testEmail,
    slug,
    membershipActive,
    wrappedDeleteProfileImage,
    firestore,
  };
}

interface CreateMemberDocumentOptions {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  slug?: string;
  membershipActive?: boolean;
  includeSlug?: boolean;
}

async function createMemberDocument({
  firestore,
  uid,
  email,
  slug,
  membershipActive = true,
  includeSlug = true,
}: CreateMemberDocumentOptions) {
  const memberData: MemberDocument = {
    createdAt: Timestamp.now(),
    email,
    uid,
    name: "Test Doula",
    subscriptionStart: Timestamp.fromDate(new Date("2024-01-15")),
    membershipActive,
    membershipExpiresAt: Timestamp.fromDate(new Date("2025-01-31")),
    ...(includeSlug && slug ? { slug } : {}),
  };

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);

  return memberData;
}

async function cleanupTestData() {
  const firestore = getFirestore();

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

interface SetupGitHubMockOptions {
  existingFiles?: string[];
  shouldThrowRateLimit?: boolean;
  shouldThrowGeneric?: boolean;
}

function setupGitHubMock({
  existingFiles = [],
  shouldThrowRateLimit = false,
  shouldThrowGeneric = false,
}: SetupGitHubMockOptions = {}) {
  const existingFilesSet = new Set(existingFiles);

  mockGetContent.mockImplementation(({ path }: { path: string }) => {
    if (shouldThrowRateLimit) {
      const rateLimitError = new Error("Rate limit exceeded");
      Object.assign(rateLimitError, {
        status: 403,
        response: {
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1234567890",
          },
        },
      });
      throw rateLimitError;
    }

    if (shouldThrowGeneric) {
      const genericError = new Error("GitHub API error");
      Object.assign(genericError, { status: 500 });
      throw genericError;
    }

    // Check if this file exists in our mock
    const fileName = path.split("/").pop() ?? "";
    if (existingFilesSet.has(fileName)) {
      return { data: { sha: `sha-for-${fileName}` } };
    }

    // File not found
    const notFoundError = new Error("Not found");
    Object.assign(notFoundError, { status: 404 });
    throw notFoundError;
  });

  mockDeleteFile.mockResolvedValue({});

  mockGetInstallationOctokit.mockReturnValue({
    rest: {
      repos: {
        getContent: mockGetContent,
        deleteFile: mockDeleteFile,
      },
    },
  });
}

describe("deleteProfileImage", () => {
  beforeEach(() => {
    mockGetContent.mockReset();
    mockDeleteFile.mockReset();
    mockGetInstallationOctokit.mockReset();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    const { wrappedDeleteProfileImage } = setup();

    try {
      await wrappedDeleteProfileImage(createMockCallableRequest({}));
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "The function must be called while authenticated",
      );
    }

    await cleanupTestData();
  });

  it("should throw error when no member document exists", async () => {
    const { testUid, wrappedDeleteProfileImage } = setup();

    try {
      await wrappedDeleteProfileImage(
        createMockCallableRequest({ uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("No member document found");
    }

    await cleanupTestData();
  });

  it("should throw error when membership is not active", async () => {
    const { testUid, testEmail, slug, wrappedDeleteProfileImage, firestore } =
      setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      membershipActive: false,
    });

    try {
      await wrappedDeleteProfileImage(
        createMockCallableRequest({ uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("does not have an active membership");
    }

    await cleanupTestData();
  });

  it("should throw error when slug is missing", async () => {
    const { testUid, testEmail, wrappedDeleteProfileImage, firestore } =
      setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      includeSlug: false,
    });

    try {
      await wrappedDeleteProfileImage(
        createMockCallableRequest({ uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Profile slug is required");
    }

    await cleanupTestData();
  });

  it("should successfully delete profile image when jpg exists", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedDeleteProfileImage,
      firestore,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ existingFiles: [`${slug}-profile.jpg`] });

    const result = await wrappedDeleteProfileImage(
      createMockCallableRequest({ uid: testUid }),
    );

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toContain(
      `hugo/content/doulas/${slug}/${slug}-profile.jpg`,
    );

    await cleanupTestData();
  });

  it("should delete multiple image files when they exist", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedDeleteProfileImage,
      firestore,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({
      existingFiles: [
        `${slug}-profile.jpg`,
        `${slug}-profile-1200.avif`,
        `${slug}-profile-600.avif`,
        `${slug}-profile-300.avif`,
      ],
    });

    const result = await wrappedDeleteProfileImage(
      createMockCallableRequest({ uid: testUid }),
    );

    expect(result.success).toBe(true);
    expect(result.deletedFiles.length).toBe(4);
    expect(mockDeleteFile).toHaveBeenCalledTimes(4);

    await cleanupTestData();
  });

  it("should succeed even when no files exist to delete", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedDeleteProfileImage,
      firestore,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ existingFiles: [] });

    const result = await wrappedDeleteProfileImage(
      createMockCallableRequest({ uid: testUid }),
    );

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toEqual([]);
    expect(mockDeleteFile).not.toHaveBeenCalled();

    await cleanupTestData();
  });

  it("should throw resource-exhausted error on GitHub rate limit", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedDeleteProfileImage,
      firestore,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ shouldThrowRateLimit: true });

    try {
      await wrappedDeleteProfileImage(
        createMockCallableRequest({ uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Too many requests");
    }

    await cleanupTestData();
  });

  it("should call GitHub API with correct parameters", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedDeleteProfileImage,
      firestore,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ existingFiles: [`${slug}-profile.jpg`] });

    await wrappedDeleteProfileImage(
      createMockCallableRequest({ uid: testUid }),
    );

    expect(mockDeleteFile).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "markgoho",
        repo: "doula-cooperative",
        path: `hugo/content/doulas/${slug}/${slug}-profile.jpg`,
        branch: "trunk",
        sha: `sha-for-${slug}-profile.jpg`,
      }),
    );

    await cleanupTestData();
  });

  it("should continue deleting other files even if some fail with non-rate-limit errors", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedDeleteProfileImage,
      firestore,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    // Only the jpg exists, others will 404 (which is handled gracefully)
    setupGitHubMock({ existingFiles: [`${slug}-profile.jpg`] });

    const result = await wrappedDeleteProfileImage(
      createMockCallableRequest({ uid: testUid }),
    );

    expect(result.success).toBe(true);
    expect(result.deletedFiles.length).toBe(1);

    await cleanupTestData();
  });
});
