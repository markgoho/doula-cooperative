import { beforeEach, describe, expect, it, mock } from "bun:test";
import { HttpError } from "../../shared-api/errors/http-error.js";
import { createProfilesTestPlugin } from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for GET /slugs/check (check slug availability).
 * Served at /api/profiles/slugs/check?slug=jane-doe via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET /slugs/check (check slug availability)", () => {
  const testApp = createProfilesTestPlugin();

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/check?slug=test-slug"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/check?slug=test-slug", {
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should allow authenticated user to check slug", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/slugs/check?slug=test-slug", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Slug availability check", () => {
    it("should return available true when slug is available", async () => {
      const mockCheckSlug = mock(() => Promise.resolve({ available: true }));

      const availableTestApp = createProfilesTestPlugin({
        profileMemberService: {
          checkSlugAvailable: mockCheckSlug,
        },
      });

      const response = (await availableTestApp.handle(
        new Request("http://localhost/slugs/check?slug=available-slug", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { available?: boolean };
      expect(body.available).toBe(true);
    });

    it("should return available false when slug is taken", async () => {
      const mockCheckSlug = mock(() => Promise.resolve({ available: false }));

      const takenTestApp = createProfilesTestPlugin({
        profileMemberService: {
          checkSlugAvailable: mockCheckSlug,
        },
      });

      const response = (await takenTestApp.handle(
        new Request("http://localhost/slugs/check?slug=taken-slug", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { available?: boolean };
      expect(body.available).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const mockCheckSlug = mock(() => {
        return Promise.reject(new Error("Firestore connection failed"));
      });

      const errorTestApp = createProfilesTestPlugin({
        profileMemberService: {
          checkSlugAvailable: mockCheckSlug,
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/slugs/check?slug=test-slug", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("Firestore");
    });
  });
});
