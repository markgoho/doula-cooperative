import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
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
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET /:slug (read profile by slug)", () => {
  const testApp = createProfilesTestPlugin();

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Public access", () => {
    it("should allow access without authentication", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user"),
        // No authorization header
      )) as Response;

      expect(response.status).toBe(200);
    });

    it("should work with authentication (but not require it)", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Profile retrieval", () => {
    it("should return structured profile data on success", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user"),
      )) as Response;

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
      const response = (await testApp.handle(
        new Request("http://localhost/test-user"),
      )) as Response;

      const body = (await response.json()) as ProfileData;
      expect(body.image).toBe("https://example.com/image.jpg");
    });

    it("should not include image when not available", async () => {
      const mockReadProfile = mock(() =>
        Promise.resolve({
          ...mockProfileData,
        }),
      );

      const noImageTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          readProfile: mockReadProfile,
        },
      });

      const response = (await noImageTestApp.handle(
        new Request("http://localhost/test-user"),
      )) as Response;

      const body = (await response.json()) as ProfileData;
      expect(body.title).toBeDefined();
      expect(body.image).toBeUndefined();
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found on GitHub", async () => {
      const mockReadProfile = mock(() => {
        return Promise.reject(new NotFoundError("Profile not found"));
      });

      const notFoundTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          readProfile: mockReadProfile,
        },
      });

      const response = (await notFoundTestApp.handle(
        new Request("http://localhost/non-existent-slug"),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 500 when GitHub service throws unexpected error", async () => {
      const mockReadProfile = mock(() => {
        return Promise.reject(new Error("GitHub API rate limit exceeded"));
      });

      const errorTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          readProfile: mockReadProfile,
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/test-user"),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("rate limit");
    });
  });

  describe("Input validation", () => {
    it("should accept valid slug with lowercase letters and hyphens", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/jane-doe"),
      )) as Response;

      expect(response.status).toBe(200);
    });

    it("should accept slug with numbers", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/jane-doe-123"),
      )) as Response;

      expect(response.status).toBe(200);
    });

    it("should reject slug with uppercase letters", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/Jane-Doe"),
      )) as Response;

      expect(response.status).toBe(422);
      // Elysia returns plain text for validation errors
      const body = await response.text();
      expect(body).toContain("lowercase");
    });

    it("should reject slug with special characters", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/jane_doe"),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject slug that is too short", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/a"),
      )) as Response;

      expect(response.status).toBe(422);
    });
  });
});
