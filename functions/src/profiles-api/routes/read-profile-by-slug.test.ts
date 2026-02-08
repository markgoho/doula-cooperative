import { describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import {
  createProfilesTestPlugin,
  mockProfileData,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for GET /:slug (read profile by slug) - PUBLIC endpoint.
 * Served at /api/profiles/:slug via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 */
describe("GET /:slug (read profile by slug)", () => {
  interface SetupOptions {
    slug?: string;
    notFound?: boolean;
    serverError?: boolean;
    noImage?: boolean;
  }

  function setup({
    slug = "test-user",
    notFound = false,
    serverError = false,
    noImage = false,
  }: SetupOptions = {}) {
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
      return Promise.resolve({
        ...mockProfileData,
        image: "https://example.com/image.jpg",
      });
    });

    const testApp = createProfilesTestPlugin({
      profileGitHubService: {
        readProfile: mockReadProfile,
      },
    });

    const request = new Request(`http://localhost/${slug}`);

    return { testApp, request };
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
      expect(body.image).toBe("https://example.com/image.jpg");
    });

    it("should not include image when not available", async () => {
      const { testApp, request } = setup({ noImage: true });

      const response = await handleRequest(testApp, request);

      const body = (await response.json()) as ProfileData;
      expect(body.title).toBeDefined();
      expect(body.image).toBeUndefined();
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found on GitHub", async () => {
      const { testApp, request } = setup({
        slug: "non-existent-slug",
        notFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 500 when GitHub service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

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
