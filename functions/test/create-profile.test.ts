/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/* eslint-disable @typescript-eslint/await-thenable */
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../src/collections/index.js";
import { createProfile } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";
import { type MemberDocument } from "../src/types/member-document.js";
import type { ProfileData } from "../src/types/profile-data.js";

// Mock the octokit module
const mockCreateOrUpdateFileContents = mock();
const mockGetInstallationOctokit = mock<
  () => {
    rest: {
      repos: {
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
  testUid = "test-create-001",
  testEmail = "testcreate001@example.com",
  slug = "test-doula-create",
  membershipActive = true,
} = {}) {
  const wrappedCreateProfile = test.wrap(createProfile);
  const firestore = getFirestore();

  // Set up environment variables for GitHub secrets
  process.env["GITHUB_APP_ID"] = "123456";
  process.env["GITHUB_PRIVATE_KEY"] = "fake-private-key";
  process.env["GITHUB_INSTALLATION_ID"] = "78910";

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
    wrappedCreateProfile,
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
  includeSlug = true,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  slug?: string;
  membershipActive?: boolean;
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
    ...(includeSlug && slug ? { slug } : {}),
  };

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);

  return memberData;
}

describe("createProfile", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockCreateOrUpdateFileContents.mockReset();
    mockGetInstallationOctokit.mockReset();

    // Default mock behavior: successful file creation
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: {
        content: {
          sha: "new-sha-123",
        },
      },
    });

    mockGetInstallationOctokit.mockReturnValue({
      rest: {
        repos: {
          createOrUpdateFileContents: mockCreateOrUpdateFileContents,
        },
      },
    });
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user not authenticated", () => {
    const { wrappedCreateProfile, profileData } = setup();

    const unauthenticatedRequest = createMockCallableRequest({
      data: profileData,
    });

    expect(
      wrappedCreateProfile(unauthenticatedRequest),
    ).rejects.toThrow("The function must be called while authenticated.");
  });

  it("should return failed-precondition when membership not active", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup({ membershipActive: false });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
      membershipActive: false,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedCreateProfile(request)).rejects.toThrow(
      "User does not have an active membership.",
    );
  });

  it("should return failed-precondition when slug missing", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      includeSlug: false,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedCreateProfile(request)).rejects.toThrow(
      "Profile slug not found. User must create a slug first.",
    );
  });

  it("should validate profile data", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    // Invalid profile data - missing required fields
    const invalidProfileData = {
      title: "",
      bio: "",
    } as ProfileData;

    const request = createMockCallableRequest({
      data: invalidProfileData,
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedCreateProfile(request)).rejects.toThrow();
  });

  it("should create GitHub file with correct path", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await wrappedCreateProfile(request);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledTimes(1);
    const call = mockCreateOrUpdateFileContents.mock.calls[0]?.[0] as {
      path: string;
      message: string;
      branch: string;
      content: string;
    };
    expect(call.path).toBe(`hugo/content/doulas/${slug}/index.md`);
    expect(call.message).toBe(`Create profile for ${profileData.title}`);
    expect(call.branch).toBe("trunk");
  });

  it("should set draft: true for new profiles", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await wrappedCreateProfile(request);

    const call = mockCreateOrUpdateFileContents.mock.calls[0]?.[0] as {
      content: string;
    };
    const content = Buffer.from(call.content, "base64").toString("utf8");
    expect(content).toContain("draft: true");
  });

  it("should set date, createdOn, updatedOn timestamps", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await wrappedCreateProfile(request);

    const call = mockCreateOrUpdateFileContents.mock.calls[0]?.[0] as {
      content: string;
    };
    const content = Buffer.from(call.content, "base64").toString("utf8");

    expect(content).toMatch(/date: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(content).toMatch(/createdOn: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(content).toMatch(/updatedOn: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("should return success after creating file", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    const result = await wrappedCreateProfile(request);

    expect(result).toEqual({ success: true });
  });

  it("should handle GitHub API rate limit errors", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    // Mock rate limit error
    mockCreateOrUpdateFileContents.mockRejectedValue({
      status: 403,
      response: {
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1234567890",
        },
      },
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedCreateProfile(request)).rejects.toThrow(
      "Too many profile creations. Please try again later.",
    );
  });

  it("should handle GitHub 409 conflict errors", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    // Mock conflict error (file already exists)
    mockCreateOrUpdateFileContents.mockRejectedValue({
      status: 409,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedCreateProfile(request)).rejects.toThrow(
      "Profile file already exists. Use the update function instead.",
    );
  });

  it("should use serializeToMarkdown correctly", async () => {
    const {
      wrappedCreateProfile,
      firestore,
      testUid,
      testEmail,
      slug,
      profileData,
    } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug,
    });

    const request = createMockCallableRequest({
      data: profileData,
      uid: testUid,
      email: testEmail,
    });

    await wrappedCreateProfile(request);

    const call = mockCreateOrUpdateFileContents.mock.calls[0]?.[0] as {
      content: string;
    };
    const content = Buffer.from(call.content, "base64").toString("utf8");

    // Verify expected frontmatter structure
    expect(content).toContain("---");
    expect(content).toContain(`title: "${profileData.title}"`);
    expect(content).toContain("type: \"doulas\"");
    expect(content).toContain(profileData.bio);

    // Verify tags format
    expect(content).toContain("tags:");
    expect(content).toContain('  - "Birth Support"');
    expect(content).toContain('  - "Postpartum Care"');

    // Verify contact format
    expect(content).toContain("contact:");
    if (profileData.contact?.phone) {
      expect(content).toContain(`  phone: ${profileData.contact.phone}`);
    }
    if (profileData.contact?.email) {
      expect(content).toContain(`  email: "${profileData.contact.email}"`);
    }
  });
});
