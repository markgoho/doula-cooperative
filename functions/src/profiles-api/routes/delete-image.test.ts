import { beforeEach, describe, expect, it, mock } from "bun:test";
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
describe("DELETE /me/image (delete profile image)", () => {
  const testApp = createProfilesTestPlugin();

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "DELETE",
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });

    it("should return 401 when token is expired", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer expired-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("session has expired");
    });
  });

  describe("Membership verification", () => {
    it("should return 428 when user has no slug", async () => {
      const noSlugTestApp = createProfilesTestPlugin({
        profileMemberService: {
          verifyActiveMembership: mock(() =>
            Promise.resolve({ ...mockMemberDocument, slug: undefined }),
          ),
        },
      });

      const response = (await noSlugTestApp.handle(
        new Request("http://localhost/me/image", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(428);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("slug");
    });
  });

  describe("Error handling", () => {
    it("should return 500 on unexpected errors", async () => {
      const errorTestApp = createProfilesTestPlugin({
        profileMemberService: {
          verifyActiveMembership: mock(() => {
            throw new Error("Unexpected database error");
          }),
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/me/image", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
    });
  });
});
