import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /me/image (upload profile image).
 * Served at /api/profiles/me/image via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 *
 * Note: These tests focus on HTTP contract (authentication, validation, error responses).
 * Actual image processing and GitHub upload logic is tested in integration tests
 * that run with emulators and mocked GitHub API.
 */
describe("POST /me/image (upload profile image)", () => {
  const testApp = createProfilesTestPlugin();

  // Mock base64 image data (1x1 red pixel PNG)
  const mockImageData =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  const validRequest = {
    imageData: mockImageData,
    mimeType: "image/png",
    cropData: { x: 0, y: 0, width: 100, height: 100 },
  };

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validRequest),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "POST",
          headers: {
            Authorization: "Bearer invalid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validRequest),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });
  });

  describe("Input validation", () => {
    it("should return 422 when imageData is missing", async () => {
      const invalidRequest = {
        mimeType: "image/png",
        cropData: { x: 0, y: 0, width: 100, height: 100 },
      };

      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidRequest),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when mimeType is invalid", async () => {
      const invalidRequest = {
        imageData: mockImageData,
        mimeType: "image/gif", // Not allowed
        cropData: { x: 0, y: 0, width: 100, height: 100 },
      };

      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidRequest),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when cropData is invalid", async () => {
      const invalidRequest = {
        imageData: mockImageData,
        mimeType: "image/png",
        cropData: { x: -1, y: 0, width: 100, height: 100 }, // Negative x
      };

      const response = (await testApp.handle(
        new Request("http://localhost/me/image", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidRequest),
        }),
      )) as Response;

      expect(response.status).toBe(422);
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
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validRequest),
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
            throw new Error("Unexpected error");
          }),
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/me/image", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validRequest),
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
    });
  });
});
