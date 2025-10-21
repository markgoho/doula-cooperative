import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { ProfileData } from "../src/types/profile-data";
import { writeProfile } from "../src";
import { MEMBERS_COLLECTION } from "../src/constants";
import { createMockCallableRequest } from "../src/test-utils/mock-request";
import { initializeTest } from "../src/test-utils/test-setup";
import { type MemberDocument } from "../src/types/member-document";

// Mock the octokit module
const mockGetContent = mock();
const mockCreateOrUpdateFileContents = mock();
const mockGetInstallationOctokit = mock<
  () => {
    rest: {
      repos: {
        getContent: typeof mockGetContent;
        createOrUpdateFileContents: typeof mockCreateOrUpdateFileContents;
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

function setup({
  testUid = "test-write-001",
  testEmail = "testwrite001@example.com",
  slug = "test-doula-write",
  membershipActive = true,
  hasProfile = true,
} = {}) {
  const wrappedWriteProfile = test.wrap(writeProfile);
  const firestore = getFirestore();

  // Set up environment variables for GitHub secrets
  process.env.GITHUB_APP_ID = "123456";
  process.env.GITHUB_PRIVATE_KEY = "fake-private-key";
  process.env.GITHUB_INSTALLATION_ID = "78910";

  const profileData: ProfileData = {
    title: "Test Doula",
    bio: "Experienced birth doula providing compassionate support.",
    credentials: "CD(DONA), CPD",
    tags: ["Birth Support", "Postpartum Care"],
    contact: {
      phone: "555-1234",
      email: "doula@example.com",
      website: "https://example.com",
      business_name: "Test Doula Services",
    },
  };

  return {
    testUid,
    testEmail,
    slug,
    membershipActive,
    hasProfile,
    wrappedWriteProfile,
    firestore,
    profileData,
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

async function cleanupWriteProfile() {
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
  existingContent = `---
title: "Test Doula"
date: 2024-01-01
createdOn: 2024-01-01T00:00:00.000Z
updatedOn: 2024-01-01T00:00:00.000Z
type: "doulas"
draft: false
---

Old bio content.`,
  shouldThrowError = false,
  errorType = "generic",
}: {
  existingContent?: string;
  shouldThrowError?: boolean;
  errorType?: "generic" | "rate-limit" | "not-found" | "conflict";
} = {}) {
  mockGetContent.mockImplementation(() => {
    if (shouldThrowError) {
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
      if (errorType === "not-found") {
        const notFoundError = new Error("Not found");
        Object.assign(notFoundError, { status: 404 });
        throw notFoundError;
      }
      if (errorType === "conflict") {
        const conflictError = new Error("Conflict");
        Object.assign(conflictError, { status: 409 });
        throw conflictError;
      }
      throw new Error("GitHub API error");
    }

    return {
      data: {
        content: Buffer.from(existingContent).toString("base64"),
        sha: "fake-sha-123",
      },
    };
  });

  mockCreateOrUpdateFileContents.mockImplementation(() => ({
    data: { commit: { sha: "new-sha-456" } },
  }));

  mockGetInstallationOctokit.mockReturnValue({
    rest: {
      repos: {
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      },
    },
  });
}

describe("writeProfile", () => {
  beforeEach(() => {
    mockGetContent.mockReset();
    mockCreateOrUpdateFileContents.mockReset();
    mockGetInstallationOctokit.mockReset();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user is not authenticated", async () => {
    // Arrange
    const { wrappedWriteProfile, profileData } = setup();

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "The function must be called while authenticated",
      );
    }

    await cleanupWriteProfile();
  });

  it("should throw error when title is missing", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      title: undefined,
    } as unknown as ProfileData;

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Title is required");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when title is empty", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = { ...profileData, title: "   " };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Title cannot be empty");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when title is too long", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = { ...profileData, title: "a".repeat(201) };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Title must be 200 characters or less");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when bio is missing", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      bio: undefined,
    } as unknown as ProfileData;

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Bio is required");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when bio is empty", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = { ...profileData, bio: "   " };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Bio cannot be empty");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when bio is too long", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = { ...profileData, bio: "a".repeat(10_001) };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Bio must be 10,000 characters or less");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when credentials is too long", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = { ...profileData, credentials: "a".repeat(501) };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Credentials must be 500 characters or less",
      );
    }

    await cleanupWriteProfile();
  });

  it("should throw error when tags is not an array", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      tags: "not-an-array",
    } as unknown as ProfileData;

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Tags must be an array");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when there are too many tags", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      tags: Array.from({ length: 51 }).map((_, index) => `tag-${index}`),
    };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Cannot have more than 50 tags");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when tag is too long", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      tags: ["a".repeat(101)],
    };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Each tag must be 100 characters or less",
      );
    }

    await cleanupWriteProfile();
  });

  it("should throw error when tag array contains non-string elements", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      // eslint-disable-next-line unicorn/no-null
      tags: [123, "valid tag", null] as unknown as string[],
    };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("All tags must be strings");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when contact is not an object", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      contact: "not an object" as unknown as ProfileData["contact"],
    };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Contact must be an object");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when contact is an array", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      contact: ["phone", "email"] as unknown as ProfileData["contact"],
    };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Contact must be an object");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when contact email is invalid", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      contact: { email: "not-an-email" },
    };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Email must be a valid email address");
    }

    await cleanupWriteProfile();
  });

  it("should throw error when contact website is invalid", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();
    const invalidData = {
      ...profileData,
      contact: { website: "not a url" },
    };

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: invalidData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Website must be a valid URL");
    }

    await cleanupWriteProfile();
  });

  it("should return not-found error when member document does not exist", async () => {
    // Arrange
    const { testUid, wrappedWriteProfile, profileData } = setup();

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("No member document found for this user");
    }

    await cleanupWriteProfile();
  });

  it("should return failed-precondition error when membership is not active", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup({ membershipActive: false });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      membershipActive: false,
    });

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "User does not have an active membership",
      );
    }

    await cleanupWriteProfile();
  });

  it("should return failed-precondition error when user does not have a profile", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup({ hasProfile: false });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      hasProfile: false,
    });

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("User does not have a profile yet");
    }

    await cleanupWriteProfile();
  });

  it("should return not-found error when slug is missing", async () => {
    // Arrange
    const { testUid, testEmail, wrappedWriteProfile, firestore, profileData } =
      setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug: undefined,
      includeSlug: false,
    });

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Profile not found");
    }

    await cleanupWriteProfile();
  });

  it("should return success when profile is updated successfully", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    const result = await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    expect(result.success).toBe(true);

    await cleanupWriteProfile();
  });

  it("should call GitHub API to get existing file", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "markgoho",
        repo: "doula-cooperative",
        path: `hugo/content/doulas/${slug}/index.md`,
      }),
    );

    await cleanupWriteProfile();
  });

  it("should call GitHub API to update file with correct parameters", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "markgoho",
        repo: "doula-cooperative",
        path: `hugo/content/doulas/${slug}/index.md`,
        sha: "fake-sha-123",
        branch: "trunk",
      }),
    );

    await cleanupWriteProfile();
  });

  it("should preserve existing date metadata", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const existingDate = "2024-01-15";
    setupGitHubMock({
      existingContent: `---
title: "Old Title"
date: ${existingDate}
createdOn: 2024-01-15T00:00:00.000Z
updatedOn: 2024-01-15T00:00:00.000Z
type: "doulas"
---

Old bio.`,
    });

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain(`date: ${existingDate}`);

    await cleanupWriteProfile();
  });

  it("should preserve existing createdOn metadata", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const createdOn = "2024-01-15T10:30:00.000Z";
    setupGitHubMock({
      existingContent: `---
title: "Old Title"
createdOn: ${createdOn}
updatedOn: 2024-01-15T00:00:00.000Z
type: "doulas"
---

Old bio.`,
    });

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain(`createdOn: ${createdOn}`);

    await cleanupWriteProfile();
  });

  it("should preserve existing draft status", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({
      existingContent: `---
title: "Old Title"
createdOn: 2024-01-15T00:00:00.000Z
updatedOn: 2024-01-15T00:00:00.000Z
type: "doulas"
draft: true
---

Old bio.`,
    });

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain("draft: true");

    await cleanupWriteProfile();
  });

  it("should update the updatedOn timestamp", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const oldUpdatedOn = "2024-01-15T00:00:00.000Z";
    setupGitHubMock({
      existingContent: `---
title: "Old Title"
updatedOn: ${oldUpdatedOn}
type: "doulas"
---

Old bio.`,
    });

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).not.toContain(`updatedOn: ${oldUpdatedOn}`);
    expect(decodedContent).toContain("updatedOn:");

    await cleanupWriteProfile();
  });

  it("should include title in markdown", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain(`title: "${profileData.title}"`);

    await cleanupWriteProfile();
  });

  it("should include credentials in markdown", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain(
      `credentials: "${profileData.credentials}"`,
    );

    await cleanupWriteProfile();
  });

  it("should include tags in YAML array format", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain("tags:");
    expect(decodedContent).toContain(`  - "Birth Support"`);
    expect(decodedContent).toContain(`  - "Postpartum Care"`);

    await cleanupWriteProfile();
  });

  it("should include bio content after frontmatter", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain("---\n\n");
    expect(decodedContent).toContain(profileData.bio);

    await cleanupWriteProfile();
  });

  it("should strip protocol from website URL", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain("website: example.com");
    expect(decodedContent).not.toContain("https://example.com");

    await cleanupWriteProfile();
  });

  it("should include contact information in markdown", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as {
      content: string;
    };
    const decodedContent = Buffer.from(
      callArguments.content,
      "base64",
    ).toString("utf8");
    expect(decodedContent).toContain("contact:");
    expect(decodedContent).toContain(
      `business_name: ${profileData.contact?.business_name}`,
    );
    expect(decodedContent).toContain(`phone: ${profileData.contact?.phone}`);
    expect(decodedContent).toContain(`email: "${profileData.contact?.email}"`);

    await cleanupWriteProfile();
  });

  it("should throw resource-exhausted error on GitHub rate limit", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ shouldThrowError: true, errorType: "rate-limit" });

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Too many profile updates");
    }

    await cleanupWriteProfile();
  });

  it("should throw not-found error when GitHub file not found", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ shouldThrowError: true, errorType: "not-found" });

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Profile file not found");
    }

    await cleanupWriteProfile();
  });

  it("should throw failed-precondition error on GitHub conflict", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ shouldThrowError: true, errorType: "conflict" });

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain(
        "Profile was modified by another process",
      );
    }

    await cleanupWriteProfile();
  });

  it("should throw internal error on generic GitHub error", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock({ shouldThrowError: true, errorType: "generic" });

    // Act & Assert
    try {
      await wrappedWriteProfile(
        createMockCallableRequest({ data: profileData, uid: testUid }),
      );
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("Failed to process profile update");
    }

    await cleanupWriteProfile();
  });

  it("should handle profile data without optional fields", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedWriteProfile, firestore } =
      setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    const minimalProfileData: ProfileData = {
      title: "Minimal Doula",
      bio: "A simple bio.",
    };

    // Act
    const result = await wrappedWriteProfile(
      createMockCallableRequest({ data: minimalProfileData, uid: testUid }),
    );

    // Assert
    expect(result.success).toBe(true);

    await cleanupWriteProfile();
  });

  it("should not include tags section when tags array is empty", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedWriteProfile, firestore, profileData } = setup();

    await createMemberDocument({ firestore, uid: testUid, email: testEmail, slug });
    setupGitHubMock();

    const dataWithEmptyTags = { ...profileData, tags: [] };

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: dataWithEmptyTags, uid: testUid })
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as { content: string };
    const decodedContent = Buffer.from(callArguments.content, "base64").toString("utf8");

    expect(decodedContent).not.toContain("tags:");

    await cleanupWriteProfile();
  });

  it("should not include contact section when contact object is empty", async () => {
    // Arrange
    const { testUid, testEmail, slug, wrappedWriteProfile, firestore, profileData } = setup();

    await createMemberDocument({ firestore, uid: testUid, email: testEmail, slug });
    setupGitHubMock();

    const dataWithEmptyContact = { ...profileData, contact: {} };

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: dataWithEmptyContact, uid: testUid })
    );

    // Assert
    const callArguments = mockCreateOrUpdateFileContents.mock.calls[0][0] as { content: string };
    const decodedContent = Buffer.from(callArguments.content, "base64").toString("utf8");

    expect(decodedContent).not.toContain("contact:");

    await cleanupWriteProfile();
  });

  it("should create commit message with profile title", async () => {
    // Arrange
    const {
      testUid,
      testEmail,
      slug,
      wrappedWriteProfile,
      firestore,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    setupGitHubMock();

    // Act
    await wrappedWriteProfile(
      createMockCallableRequest({ data: profileData, uid: testUid }),
    );

    // Assert
    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Update profile for ${profileData.title}`,
      }),
    );

    await cleanupWriteProfile();
  });
});
