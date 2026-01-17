import { describe, expect, it, mock } from "bun:test";
import { createProfilesTestPlugin } from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for GET /slugs/check (check slug availability) - PUBLIC endpoint.
 * Served at /api/profiles/slugs/check?slug=jane-doe via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 */
describe("GET /slugs/check (check slug availability)", () => {
  interface SetupOptions {
    slug?: string;
    available?: boolean;
    serverError?: boolean;
  }

  function setup({
    slug = "test-slug",
    available = true,
    serverError = false,
  }: SetupOptions = {}) {
    const mockCheckSlug = mock(() => {
      if (serverError) {
        return Promise.reject(new Error("Firestore connection failed"));
      }
      return Promise.resolve({ available });
    });

    const testApp = createProfilesTestPlugin({
      profileMemberService: {
        checkSlugAvailable: mockCheckSlug,
      },
    });

    const request = new Request(`http://localhost/slugs/check?slug=${slug}`);

    return { testApp, request };
  }

  describe("Public access", () => {
    it("should allow access without authentication", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Slug availability check", () => {
    it("should return available true when slug is available", async () => {
      const { testApp, request } = setup({
        slug: "available-slug",
        available: true,
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { available?: boolean };
      expect(body.available).toBe(true);
    });

    it("should return available false when slug is taken", async () => {
      const { testApp, request } = setup({
        slug: "taken-slug",
        available: false,
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { available?: boolean };
      expect(body.available).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("Firestore");
    });
  });
});
