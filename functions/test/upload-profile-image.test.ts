import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../src/collections/index.js";
import { uploadProfileImage } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";
import { type MemberDocument } from "../src/types/member-document.js";

// Helper to create GitHub errors with status codes
function createGitHubError(message: string, status?: number, isRateLimit = false): Error & { status?: number; response?: { headers?: Record<string, string> } } {
  const error = new Error(message) as Error & { status?: number; response?: { headers?: Record<string, string> } };
  if (status) {
    error.status = status;
  }
  if (isRateLimit) {
    error.response = {
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1234567890",
      },
    };
  }
  return error;
}

// Mock sharp module
const mockMetadata = mock<() => Promise<{ width: number; height: number }>>();
const mockExtract = mock<() => unknown>();
const mockResize = mock<() => unknown>();
const mockJpeg = mock<() => unknown>();
const mockAvif = mock<() => unknown>();
const mockToBuffer = mock<() => Promise<Buffer>>();

void mock.module("sharp", () => ({
  default: () => ({
    metadata: mockMetadata,
    extract: mockExtract,
    resize: mockResize,
    jpeg: mockJpeg,
    avif: mockAvif,
    toBuffer: mockToBuffer,
  }),
}));

// Mock the octokit module
const mockGetContent = mock();
const mockCreateOrUpdateFileContents = mock();
const mockGetReference = mock();
const mockGetCommit = mock();
const mockGetTree = mock();
const mockCreateBlob = mock();
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
        createBlob: typeof mockCreateBlob;
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

function setup(options: {
  testUid?: string;
  testEmail?: string;
  slug?: string;
  membershipActive?: boolean;
} = {}) {
  const {
    testUid = "test-upload-001",
    testEmail = "testupload001@example.com",
    slug = "test-doula-upload",
    membershipActive = true,
  } = options;

  const wrappedUploadProfileImage = test.wrap(uploadProfileImage);
  const firestore = getFirestore();

  // Set up environment variables for GitHub secrets
  process.env["GITHUB_APP_ID"] = "123456";
  process.env["GITHUB_PRIVATE_KEY"] = "fake-private-key";
  process.env["GITHUB_INSTALLATION_ID"] = "78910";

  // Create a small 1x1 pixel PNG as test data
  const testImageBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  const validCropData = {
    x: 100,
    y: 100,
    width: 500,
    height: 500,
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

async function createMemberDocument(
  firestore: ReturnType<typeof getFirestore>,
  uid: string,
  email: string,
  options: {
    slug?: string;
    membershipActive?: boolean;
    includeSlug?: boolean;
  } = {},
) {
  const { slug, membershipActive = true, includeSlug = true } = options;

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

function setupGitHubMock(options: {
  shouldThrowOnGetContent?: boolean;
  shouldThrowOnUpdate?: boolean;
  errorType?: "generic" | "rate-limit" | "not-found";
  existingSha?: string;
} = {}) {
  const {
    shouldThrowOnGetContent = false,
    shouldThrowOnUpdate = false,
    errorType = "generic",
    existingSha,
  } = options;
  mockGetContent.mockImplementation(() => {
    if (shouldThrowOnGetContent) {
      if (errorType === "not-found") {
        throw createGitHubError("Not found", 404);
      }
      if (errorType === "rate-limit") {
        throw createGitHubError("Rate limit exceeded", 403, true);
      }
      throw new Error("GitHub API error");
    }

    if (existingSha) {
      return { data: { sha: existingSha } };
    }
    throw createGitHubError("Not found", 404);
  });

  mockCreateOrUpdateFileContents.mockImplementation(() => {
    if (shouldThrowOnUpdate) {
      if (errorType === "rate-limit") {
        throw createGitHubError("Rate limit exceeded", 403, true);
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

  mockCreateBlob.mockResolvedValue({
    data: { sha: "new-blob-sha" },
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
        createBlob: mockCreateBlob,
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
    return Promise.resolve({ width, height });
  });

  mockExtract.mockImplementation(() => {
    if (shouldThrow) {
      throw new Error("Failed to extract image region");
    }
    return {
      resize: mockResize,
    };
  });

  mockResize.mockReturnValue({
    jpeg: mockJpeg,
    avif: mockAvif,
    toBuffer: mockToBuffer,
  });

  mockJpeg.mockReturnValue({
    toBuffer: mockToBuffer,
  });

  mockAvif.mockReturnValue({
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
    mockCreateBlob.mockReset();
    mockCreateTree.mockReset();
    mockCreateCommit.mockReset();
    mockUpdateReference.mockReset();
    mockGetInstallationOctokit.mockReset();
    mockMetadata.mockReset();
    mockExtract.mockReset();
    mockResize.mockReset();
    mockJpeg.mockReset();
    mockAvif.mockReset();
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

  it("should throw error when crop data x is negative", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: -10, y: 100, width: 500, height: 500 },
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
            cropData: { x: 100, y: -20, width: 500, height: 500 },
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

  it("should throw error when crop data width is zero", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 100, y: 100, width: 0, height: 500 },
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

  it("should throw error when crop data width is negative", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 100, y: 100, width: -100, height: 500 },
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

  it("should throw error when crop data height is zero", async () => {
    const { testUid, wrappedUploadProfileImage, testImageBase64 } = setup();

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: {
            imageData: testImageBase64,
            mimeType: "image/png",
            cropData: { x: 100, y: 100, width: 500, height: 0 },
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

    await createMemberDocument(firestore, testUid, testEmail, {
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

    await createMemberDocument(firestore, testUid, testEmail, {
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

    await createMemberDocument(firestore, testUid, testEmail, { slug });

    const result = await wrappedUploadProfileImage(
      createMockCallableRequest({
        data: validRequestData,
        uid: testUid,
      }),
    );

    expect(result.success).toBe(true);

    // Verify batch operations were used (createBlob should be called for JPEG + 3 AVIFs)
    expect(mockCreateBlob).toHaveBeenCalledTimes(4);
    expect(mockCreateTree).toHaveBeenCalledTimes(1);
    expect(mockCreateCommit).toHaveBeenCalledTimes(1);

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

    await createMemberDocument(firestore, testUid, testEmail, { slug });

    const result = await wrappedUploadProfileImage(
      createMockCallableRequest({
        data: validRequestData,
        uid: testUid,
      }),
    );

    expect(result.success).toBe(true);

    // Verify batch operations were used
    expect(mockCreateBlob).toHaveBeenCalledTimes(4); // JPEG + 3 AVIFs
    expect(mockCreateTree).toHaveBeenCalledTimes(1);
    expect(mockCreateCommit).toHaveBeenCalledTimes(1);

    await cleanupTestData();
  });

  it("should generate AVIF variants in addition to JPEG", async () => {
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

    await createMemberDocument(firestore, testUid, testEmail, { slug });

    await wrappedUploadProfileImage(
      createMockCallableRequest({
        data: validRequestData,
        uid: testUid,
      }),
    );

    // Verify AVIF method was called for each variant (1200, 600, 300)
    expect(mockAvif).toHaveBeenCalledTimes(3);
    expect(mockAvif).toHaveBeenCalledWith({ quality: 50 });

    // Verify JPEG was generated once
    expect(mockJpeg).toHaveBeenCalledTimes(1);
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 90 });

    await cleanupTestData();
  });

  it("should create single atomic commit with all files", async () => {
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

    await createMemberDocument(firestore, testUid, testEmail, { slug });

    await wrappedUploadProfileImage(
      createMockCallableRequest({
        data: validRequestData,
        uid: testUid,
      }),
    );

    // Verify single commit was created with all files
    expect(mockCreateCommit).toHaveBeenCalledTimes(1);
    const commitCalls = mockCreateCommit.mock.calls as [{ message: string; tree: string; parents: string[] }][];
    expect(commitCalls.length).toBe(1);
    expect(commitCalls[0]?.[0]?.message).toContain("Update profile images for");

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
    setupGitHubMock();

    // Override mockCreateBlob to throw rate limit error
    mockCreateBlob.mockRejectedValue(createGitHubError("Rate limit exceeded", 403, true));

    await createMemberDocument(firestore, testUid, testEmail, { slug });

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Failed to save profile images");
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
    setupGitHubMock();

    // Override mockCreateBlob to throw generic error
    mockCreateBlob.mockRejectedValue(new Error("GitHub API error"));

    await createMemberDocument(firestore, testUid, testEmail, { slug });

    try {
      await wrappedUploadProfileImage(
        createMockCallableRequest({
          data: validRequestData,
          uid: testUid,
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Failed to save profile images");
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

    await createMemberDocument(firestore, testUid, testEmail, { slug });

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
