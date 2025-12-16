import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConflictError } from "../../shared-api/errors/http-error.js";
import { createProfilesTestPlugin } from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /slugs/me (set profile slug).
 * Served at /api/profiles/slugs/me via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /slugs/me (set profile slug)", () => {
  const testApp = createProfilesTestPlugin();

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug: "test-slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer invalid-token",
          },
          body: JSON.stringify({ slug: "test-slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should allow authenticated user to set slug", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "test-slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("should return 422 when slug is too short", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "a" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when slug has uppercase letters", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "Test-Slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when slug has special characters", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "test_slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid slug with lowercase and hyphens", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "jane-doe-doula" }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Slug setting", () => {
    it("should return success when slug is set", async () => {
      const mockSetSlug = mock(() => Promise.resolve({ slug: "new-slug" }));

      const setSlugTestApp = createProfilesTestPlugin({
        profileMemberService: {
          setSlug: mockSetSlug,
        },
      });

      const response = (await setSlugTestApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "new-slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { slug?: string };
      expect(body.slug).toBe("new-slug");
    });

    it("should return 409 when slug is already taken", async () => {
      const mockSetSlug = mock(() => {
        return Promise.reject(
          new ConflictError("This slug is already taken. Please choose another."),
        );
      });

      const conflictTestApp = createProfilesTestPlugin({
        profileMemberService: {
          setSlug: mockSetSlug,
        },
      });

      const response = (await conflictTestApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "taken-slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already taken");
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const mockSetSlug = mock(() => {
        return Promise.reject(new Error("Database write failed"));
      });

      const errorTestApp = createProfilesTestPlugin({
        profileMemberService: {
          setSlug: mockSetSlug,
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/slugs/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ slug: "test-slug" }),
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("Database");
    });
  });
});
