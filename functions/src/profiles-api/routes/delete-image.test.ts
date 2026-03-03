import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

// Set module-level environment variables for ImageKit
process.env["IMAGEKIT_PRIVATE_KEY"] = "test-private-key";

/**
 * Tests for DELETE /:slug/image (delete profile image).
 * Served at /api/profiles/:slug/image via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 *
 * Tests verify ImageKit search + deletion and error handling.
 */
describe("DELETE /:slug/image (delete profile image)", () => {
  interface SetupOptions {
    slug?: string;
    authToken?: string | null;

    memberHasNoSlug?: boolean;
    imagekitListReturnsEmpty?: boolean;
    imagekitDeleteFails?: boolean;
    unexpectedError?: boolean;
  }

  function setup({
    slug = "test-user",
    authToken = "valid-token",
    memberHasNoSlug = false,
    imagekitListReturnsEmpty = false,
    imagekitDeleteFails = false,
    unexpectedError = false,
  }: SetupOptions = {}) {
    const mockDeleteFile = mock(() => {
      if (imagekitDeleteFails) {
        throw new Error("ImageKit deletion failed");
      }
      return Promise.resolve();
    });

    const mockListFiles = mock(() => {
      if (imagekitListReturnsEmpty) {
        return Promise.resolve([]);
      }
      return Promise.resolve([
        {
          fileId: "ik-file-123",
          name: "test-user-profile",
          filePath: "/doulas/test-user/test-user-profile",
        },
      ]);
    });

    void mock.module("../utils/imagekit-client.js", () => ({
      getImageKitClient: () => ({
        assets: { list: mockListFiles },
        files: { delete: mockDeleteFile },
      }),
    }));

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

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${slug}/image`, {
      method: "DELETE",
      headers,
    });

    return {
      testApp,
      request,
      mockDeleteFile,
      mockListFiles,
    };
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

    it("should return 401 when token is expired", async () => {
      const { testApp, request } = setup({ authToken: "expired-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("session has expired");
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

  describe("Success cases", () => {
    it("should search ImageKit and delete the found file", async () => {
      const { testApp, request, mockListFiles, mockDeleteFile } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);

      expect(mockListFiles).toHaveBeenCalled();
      expect(mockDeleteFile).toHaveBeenCalledWith("ik-file-123");
    });

    it("should succeed when no ImageKit file is found (already deleted)", async () => {
      const { testApp, request, mockDeleteFile, mockListFiles } = setup({
        imagekitListReturnsEmpty: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);

      expect(mockListFiles).toHaveBeenCalled();
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should return 500 when ImageKit deletion fails", async () => {
      const { testApp, request } = setup({
        imagekitDeleteFails: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("delete profile image");
    });

    it("should return 500 on unexpected errors", async () => {
      const { testApp, request } = setup({ unexpectedError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
    });
  });
});
