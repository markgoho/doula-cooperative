import { describe, expect, it, mock } from "bun:test";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for DELETE /me/image (delete profile image).
 * Served at /api/profiles/me/image via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 *
 * Note: These tests focus on HTTP contract (authentication, error responses).
 * Actual GitHub deletion logic is tested in integration tests
 * that run with mocked GitHub API.
 */
describe("DELETE /:slug/image (delete profile image)", () => {
  interface SetupOptions {
    // Request parameters
    slug?: string;
    authToken?: string | null;

    // Scenario flags
    memberHasNoSlug?: boolean;
    unexpectedError?: boolean;
  }

  function setup({
    slug = "test-user",
    authToken = "valid-token",
    memberHasNoSlug = false,
    unexpectedError = false,
  }: SetupOptions = {}) {
    // Configure mocks based on scenario flags
    const mockVerifyMembership = mock(() => {
      if (unexpectedError) {
        throw new Error("Unexpected database error");
      }
      if (memberHasNoSlug) {
        const memberDocumentWithoutSlug = { ...mockMemberDocument };
        delete memberDocumentWithoutSlug.slug;
        return Promise.resolve(memberDocumentWithoutSlug);
      }
      return Promise.resolve(mockMemberDocument);
    });

    const testApp = createProfilesTestPlugin({
      profileMemberService: {
        verifyActiveMembership: mockVerifyMembership,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${slug}/image`, {
      method: "DELETE",
      headers,
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const { testApp, request } = setup({ authToken: "invalid-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });

    it("should return 401 when token is expired", async () => {
      const { testApp, request } = setup({ authToken: "expired-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("session has expired");
    });
  });

  describe("Membership verification", () => {
    it("should return 428 when user has no slug", async () => {
      const { testApp, request } = setup({ memberHasNoSlug: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(428);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("slug");
    });
  });

  describe("Error handling", () => {
    it("should return 500 on unexpected errors", async () => {
      const { testApp, request } = setup({ unexpectedError: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
    });
  });
});
