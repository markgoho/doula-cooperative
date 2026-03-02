import { describe, expect, it, mock } from "bun:test";
import type { MemberDocument } from "../../collections/index.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
  mockProfileData,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for GET /:slug (read profile by slug) - PUBLIC endpoint.
 * Served at /api/profiles/:slug via Firebase rewrite.
 *
 * Reads from Firestore first; falls back to GitHub on cache miss.
 * Uses createProfilesTestPlugin() factory with mocked services.
 */
describe("GET /:slug (read profile by slug)", () => {
  interface SetupOptions {
    slug?: string;
    notFound?: boolean;
    serverError?: boolean;
    noImage?: boolean;
    firestoreCacheHit?: boolean;
    firestoreMemberNotFound?: boolean;
    firestoreError?: boolean;
  }

  function setup({
    slug = "test-user",
    notFound = false,
    serverError = false,
    noImage = false,
    firestoreCacheHit = true,
    firestoreMemberNotFound = false,
    firestoreError = false,
  }: SetupOptions = {}) {
    const profileWithImage: ProfileData = {
      ...mockProfileData,
      image:
        "https://ik.imagekit.io/doulacoop/doulas/test-user/test-user-profile",
    };

    const mockGetMemberBySlug = mock(
      (): Promise<MemberDocument | undefined> => {
        if (firestoreError) {
          return Promise.reject(new Error("Firestore unavailable"));
        }
        if (firestoreMemberNotFound) {
          return Promise.resolve(undefined);
        }
        if (firestoreCacheHit) {
          return Promise.resolve({
            ...mockMemberDocument,
            profile: noImage ? mockProfileData : profileWithImage,
          });
        }
        // Cache miss — member exists but has no profile field
        return Promise.resolve({ ...mockMemberDocument });
      },
    );

    const mockReadProfile = mock(() => {
      if (notFound) {
        return Promise.reject(new NotFoundError("Profile not found"));
      }
      if (serverError) {
        return Promise.reject(new Error("GitHub API rate limit exceeded"));
      }
      if (noImage) {
        return Promise.resolve(mockProfileData);
      }
      return Promise.resolve(profileWithImage);
    });

    const testApp = createProfilesTestPlugin({
      profileGitHubService: {
        readProfile: mockReadProfile,
      },
      profileMemberService: {
        getMemberBySlug: mockGetMemberBySlug,
      },
    });

    const request = new Request(`http://localhost/${slug}`);

    return { testApp, request, mockReadProfile };
  }

  describe("Public access", () => {
    it("should allow access without authentication", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });

    it("should work with authentication (but not require it)", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });
  });

  describe("Profile retrieval", () => {
    it("should return structured profile data on success", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as ProfileData;
      expect(body.title).toBe("Test Doula");
      expect(body.bio).toBe("This is a test bio for the doula profile.");
      expect(body.credentials).toBe("CD(DONA)");
      expect(body.pronouns).toBe("she/her");
      expect(body.tags).toEqual(["birth-doula", "postpartum"]);
      expect(body.contact?.email).toBe("test@example.com");
    });

    it("should include image URL when available", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      const body = (await response.json()) as ProfileData;
      expect(body.image).toBe(
        "https://ik.imagekit.io/doulacoop/doulas/test-user/test-user-profile",
      );
    });

    it("should not include image when not available", async () => {
      const { testApp, request } = setup({ noImage: true });

      const response = await handleRequest(testApp, request);

      const body = (await response.json()) as ProfileData;
      expect(body.title).toBeDefined();
      expect(body.image).toBeUndefined();
    });
  });

  describe("Firestore cache", () => {
    it("should read from Firestore when profile is cached", async () => {
      const { testApp, request, mockReadProfile } = setup({
        firestoreCacheHit: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as ProfileData;
      expect(body.title).toBe("Test Doula");
      // GitHub should NOT be called when Firestore has the data
      expect(mockReadProfile).not.toHaveBeenCalled();
    });

    it("should fall back to GitHub when Firestore has no cached profile", async () => {
      const { testApp, request, mockReadProfile } = setup({
        firestoreCacheHit: false,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as ProfileData;
      expect(body.title).toBe("Test Doula");
      expect(mockReadProfile).toHaveBeenCalled();
    });

    it("should fall back to GitHub when member not found in Firestore", async () => {
      const { testApp, request, mockReadProfile } = setup({
        firestoreMemberNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      expect(mockReadProfile).toHaveBeenCalled();
    });

    it("should fall back to GitHub when Firestore throws an error", async () => {
      const { testApp, request, mockReadProfile } = setup({
        firestoreError: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as ProfileData;
      expect(body.title).toBe("Test Doula");
      expect(mockReadProfile).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found on GitHub (cache miss)", async () => {
      const { testApp, request } = setup({
        slug: "non-existent-slug",
        notFound: true,
        firestoreMemberNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 500 when GitHub service throws unexpected error (cache miss)", async () => {
      const { testApp, request } = setup({
        serverError: true,
        firestoreMemberNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("rate limit");
    });
  });

  describe("Input validation", () => {
    it("should accept valid slug with lowercase letters and hyphens", async () => {
      const { testApp, request } = setup({ slug: "jane-doe" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });

    it("should accept slug with numbers", async () => {
      const { testApp, request } = setup({ slug: "jane-doe-123" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });

    it("should reject slug with uppercase letters", async () => {
      const { testApp, request } = setup({ slug: "Jane-Doe" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
      // Elysia returns plain text for validation errors
      const body = await response.text();
      expect(body).toContain("lowercase");
    });

    it("should reject slug with special characters", async () => {
      const { testApp, request } = setup({ slug: "jane_doe" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should reject slug that is too short", async () => {
      const { testApp, request } = setup({ slug: "a" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });
});
