import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /:slug/image (upload profile image).
 * Served at /api/profiles/:slug/image via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 *
 * Note: These tests focus on HTTP contract (authentication, validation, error responses).
 * Actual image processing and GitHub upload logic is tested in integration tests
 * that run with emulators and mocked GitHub API.
 */
describe("POST /:slug/image (upload profile image)", () => {
  // Mock base64 image data (1x1 red pixel PNG)
  const mockImageData =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  const validRequest = {
    imageData: mockImageData,
    mimeType: "image/png",
    cropData: { x: 0, y: 0, width: 100, height: 100 },
  };

  interface SetupOptions {
    // Request parameters
    slug?: string;
    body?: Record<string, unknown>;
    authToken?: string | null;

    // Scenario flags
    memberHasNoSlug?: boolean;
    unexpectedError?: boolean;
  }

  function setup({
    slug = "test-user",
    body = validRequest,
    authToken = "valid-token",
    memberHasNoSlug = false,
    unexpectedError = false,
  }: SetupOptions = {}) {
    // Configure mocks based on scenario flags
    const mockVerifyMembership = mock(() => {
      if (unexpectedError) {
        throw new Error("Unexpected error");
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${slug}/image`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const { testApp, request } = setup({ authToken: "invalid-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });
  });

  describe("Input validation", () => {
    it("should return 422 when imageData is missing", async () => {
      const { testApp, request } = setup({
        body: {
          mimeType: "image/png",
          cropData: { x: 0, y: 0, width: 100, height: 100 },
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 422 when mimeType is invalid", async () => {
      const { testApp, request } = setup({
        body: {
          imageData: mockImageData,
          mimeType: "image/gif",
          cropData: { x: 0, y: 0, width: 100, height: 100 },
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 422 when cropData is invalid", async () => {
      const { testApp, request } = setup({
        body: {
          imageData: mockImageData,
          mimeType: "image/png",
          cropData: { x: -1, y: 0, width: 100, height: 100 },
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Membership verification", () => {
    it("should return 428 when user has no slug", async () => {
      const { testApp, request } = setup({ memberHasNoSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(428);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("slug");
    });
  });

  describe("Error handling", () => {
    it("should return 500 on unexpected errors", async () => {
      const { testApp, request } = setup({ unexpectedError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
    });
  });

  describe("GitHub configuration", () => {
    it("should return 500 when GITHUB_APP_ID is missing", async () => {
      // Save and clear the environment variable
      const originalValue = process.env["GITHUB_APP_ID"];
      delete process.env["GITHUB_APP_ID"];

      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);

      // Restore the environment variable
      if (originalValue !== undefined) {
        process.env["GITHUB_APP_ID"] = originalValue;
      }

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("GitHub configuration");
    });

    it("should return 500 when GITHUB_PRIVATE_KEY is missing", async () => {
      const originalValue = process.env["GITHUB_PRIVATE_KEY"];
      delete process.env["GITHUB_PRIVATE_KEY"];

      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);

      if (originalValue !== undefined) {
        process.env["GITHUB_PRIVATE_KEY"] = originalValue;
      }

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("GitHub configuration");
    });

    it("should return 500 when GITHUB_INSTALLATION_ID is missing", async () => {
      const originalValue = process.env["GITHUB_INSTALLATION_ID"];
      delete process.env["GITHUB_INSTALLATION_ID"];

      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);

      if (originalValue !== undefined) {
        process.env["GITHUB_INSTALLATION_ID"] = originalValue;
      }

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("GitHub configuration");
    });
  });
});
