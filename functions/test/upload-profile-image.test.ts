import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../src/collections/index.js";
import { uploadProfileImage } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";
import { type MemberDocument } from "../src/types/member-document.js";

// Mock sharp module
const mockMetadata = mock<() => Promise<{ width: number; height: number }>>();
const mockExtract = mock<() => unknown>();
const mockResize = mock<() => unknown>();
const mockJpeg = mock<() => unknown>();
const mockToBuffer = mock<() => Promise<Buffer>>();

void mock.module("sharp", () => ({
  default: () => ({
    metadata: mockMetadata,
    extract: mockExtract,
    resize: mockResize,
    jpeg: mockJpeg,
    toBuffer: mockToBuffer,
  }),
}));

// Mock the octokit module
const mockGetContent = mock();
const mockCreateOrUpdateFileContents = mock();
const mockGetReference = mock();
const mockGetCommit = mock();
const mockGetTree = mock();
const mockCreateTree = mock();
const mockCreateCommit = mock();
const mockUpdateReference = mock();
const mockGetInstallationOctokit = mock<
  () => {
    rest: {
      repos: {
        getContent: typeof mockGetContent;
        createOrUpdateFileContents: typeof mockCreateOrUpdateFileContents;
      };
      git: {
        getRef: typeof mockGetReference;
        getCommit: typeof mockGetCommit;
        getTree: typeof mockGetTree;
        createTree: typeof mockCreateTree;
        createCommit: typeof mockCreateCommit;
        updateRef: typeof mockUpdateReference;
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
  testUid = "test-upload-001",
  testEmail = "testupload001@example.com",
  slug = "test-doula-upload",
  membershipActive = true,
}: SetupOptions = {}) {
  const wrappedUploadProfileImage = test.wrap(uploadProfileImage);
  const firestore = getFirestore();

  // Set up environment variables for GitHub secrets
  process.env["GITHUB_APP_ID"] = "123456";
  process.env["GITHUB_PRIVATE_KEY"] = "fake-private-key";
  process.env["GITHUB_INSTALLATION_ID"] = "78910";

  // Create a small 1x1 red pixel PNG as test data
  // This is a valid base64-encoded PNG
  const testImageBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  const validCropData = {
    x: 0.5,
    y: 0.5,
    zoom: 1,
  };

  const validRequestData = {
    imageData: testImageBase64,
    mimeType: "image/png",
    cropData: validCropData,
  };

  return {
    testUid,
    testEmail,
    slug,
    membershipActive,
    wrappedUploadProfileImage,
    firestore,
    testImageBase64,
    validCropData,
    validRequestData,
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
  shouldThrowOnGetContent?: boolean;
  shouldThrowOnUpdate?: boolean;
  errorType?: "generic" | "rate-limit" | "not-found";
  existingSha?: string;
}

function setupGitHubMock({
  shouldThrowOnGetContent = false,
  shouldThrowOnUpdate = false,
  errorType = "generic",
  existingSha,
}: SetupGitHubMockOptions = {}) {
  mockGetContent.mockImplementation(() => {
    if (shouldThrowOnGetContent) {
      if (errorType === "not-found") {
        const notFoundError = new Error("Not found");
        Object.assign(notFoundError, { status: 404 });
        throw notFoundError;
      }
      if (errorType === "rate-limit") {
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
      throw new Error("GitHub API error");
    }

    if (existingSha) {
      return { data: { sha: existingSha } };
    }
    const notFoundError = new Error("Not found");
    Object.assign(notFoundError, { status: 404 });
    throw notFoundError;
  });

  mockCreateOrUpdateFileContents.mockImplementation(() => {
    if (shouldThrowOnUpdate) {
      if (errorType === "rate-limit") {
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
      throw new Error("GitHub API error");
    }
    return { data: { commit: { sha: "new-sha-456" } } };
  });

  // Mock Git API methods for batch delete
  mockGetReference.mockResolvedValue({
    data: { object: { sha: "current-commit-sha" } },
  });

  mockGetCommit.mockResolvedValue({
    data: { tree: { sha: "current-tree-sha" } },
  });

  mockGetTree.mockResolvedValue({
    data: { tree: [] },
  });

  mockCreateTree.mockResolvedValue({
    data: { sha: "new-tree-sha" },
  });

  mockCreateCommit.mockResolvedValue({
    data: { sha: "new-commit-sha" },
  });

  mockUpdateReference.mockResolvedValue({
    data: {},
  });

  mockGetInstallationOctokit.mockReturnValue({
    rest: {
      repos: {
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      },
      git: {
        getRef: mockGetReference,
        getCommit: mockGetCommit,
        getTree: mockGetTree,
        createTree: mockCreateTree,
        createCommit: mockCreateCommit,
        updateRef: mockUpdateReference,
      },
    },
  });
}

function setupSharpMock({
  shouldThrow = false,
  width = 1000,
  height = 1000,
}: {
  shouldThrow?: boolean;
  width?: number;
  height?: number;
} = {}) {
  mockMetadata.mockImplementation(() => {
    if (shouldThrow) {
      throw new Error("Failed to read image metadata");
    }
    return Promise.resolve({ width, height });
  });

  mockExtract.mockReturnValue({
    resize: mockResize,
  });

  mockResize.mockReturnValue({
    jpeg: mockJpeg,
  });

  mockJpeg.mockReturnValue({
    toBuffer: mockToBuffer,
  });

  mockToBuffer.mockResolvedValue(Buffer.from("processed-image-data"));
}

describe("uploadProfileImage", () => {
  beforeEach(() => {
    mockGetContent.mockReset();
    mockCreateOrUpdateFileContents.mockReset();
    mockGetReference.mockReset();
    mockGetCommit.mockReset();
    mockGetTree.mockReset();
    mockCreateTree.mockReset();
    mockCreateCommit.mockReset();
    mockUpdateReference.mockReset();
    mockGetInstallationOctokit.mockReset();
    mockMetadata.mockReset();
    mockExtract.mockReset();
    mockResize.mockReset();
    mockJpeg.mockReset();
    mockToBuffer.mockReset();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    const { wrappedUploadProfileImage, validRequestData } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({ data: validRequestData }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "The function must be called while authenticated",
      );
    }

    await cleanupTestData();
  });

  it("should throw error when image data is missing", async () => {
    const { testUid, wrappedUploadProfileImage, validCropData } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: { mimeType: "image/png", cropData: validCropData },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Image data is required");
    }

    await cleanupTestData();
  });

  it("should throw error when MIME type is invalid", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64, validCropData } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/gif",
            cropData: validCropData,
          },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Invalid image type");
    }

    await cleanupTestData();
  });

  it("should throw error when image exceeds maximum size", async () => {
    const { testUid, wrappedUploadProfileImage, validCropData } = setup();

    // Create data larger than 10MB when decoded
    // Need 11MB of raw data so decoded buffer exceeds 10MB limit
    const largeData = "A".repeat(11 * 1024 * 1024);
    const largeImageBase64 = `data:image/png;base64,${Buffer.from(largeData).toString("base64")}`;

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: largeImageBase64,
            mimeType: "image/png",
            cropData: validCropData,
          },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Image too large");
    }

    await cleanupTestData();
  });

  it("should throw error when crop data is invalid (x out of range)", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 1.5, y: 0.5, zoom: 1 },
          },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Invalid crop data");
    }

    await cleanupTestData();
  });

  it("should throw error when crop data is invalid (zoom too low)", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 0.5, y: 0.5, zoom: 0.5 },
          },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Invalid crop data");
    }

    await cleanupTestData();
  });

  it("should throw error when crop data zoom exceeds maximum (> 10)", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 0.5, y: 0.5, zoom: 11 },
          },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Invalid crop data");
    }

    await cleanupTestData();
  });

  it("should throw error when crop data y is negative", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 0.5, y: -0.1, zoom: 1 },
          },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Invalid crop data");
    }

    await cleanupTestData();
  });

  it("should throw error when crop data y exceeds maximum (> 1)", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 0.5, y: 1.5, zoom: 1 },
          },
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Invalid crop data");
    }

    await cleanupTestData();
  });

  it("should throw error when no member document exists", async () => {
    const { testUid, wrappedUploadProfileImage, validRequestData } = setup();
    setupSharpMock();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("No member document found");
    }

    await cleanupTestData();
  });

  it("should throw error when membership is not active", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      membershipActive: false,
    });

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("does not have an active membership");
    }

    await cleanupTestData();
  });

  it("should throw error when slug is missing", async () => {
    const {
      testUid,
      testEmail,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      includeSlug: false,
    });

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Profile slug is required");
    }

    await cleanupTestData();
  });

  it("should successfully upload profile image for new file", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock();
    setupGitHubMock();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const result = await wrappedUploadProfileImage(
      createMockCallableRequest({
        data: validRequestData,
        uid: testUid,
      }),
    );

    expect(result.success).toBe(true);

    await cleanupTestData();
  });

  it("should update existing profile image when sha exists", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock();
    setupGitHubMock({ existingSha: "existing-sha-123" });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const result = await wrappedUploadProfileImage(
      createMockCallableRequest({
        data: validRequestData,
        uid: testUid,
      }),
    );

    expect(result.success).toBe(true);
    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: "existing-sha-123",
      }),
    );

    await cleanupTestData();
  });

  it("should call GitHub API with correct file path", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock();
    setupGitHubMock();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    await wrappedUploadProfileImage(
      createMockCallableRequest({
        data: validRequestData,
        uid: testUid,
      }),
    );

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "markgoho",
        repo: "doula-cooperative",
        path: `hugo/content/doulas/${slug}/${slug}-profile.jpg`,
        branch: "trunk",
      }),
    );

    await cleanupTestData();
  });

  it("should throw resource-exhausted error on GitHub rate limit", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock();
    setupGitHubMock({ shouldThrowOnUpdate: true, errorType: "rate-limit" });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Too many requests");
    }

    await cleanupTestData();
  });

  it("should throw internal error on generic GitHub error", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock();
    setupGitHubMock({ shouldThrowOnUpdate: true, errorType: "generic" });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Failed to save profile image");
    }

    await cleanupTestData();
  });

  it("should throw error when image processing fails", async () => {
    const {
      testUid,
      testEmail,
      slug,
      wrappedUploadProfileImage,
      firestore,
      validRequestData,
    } = setup();
    setupSharpMock({ shouldThrow: true });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Failed to process image");
    }

    await cleanupTestData();
  });
});
