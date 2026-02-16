import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

// Set module-level environment variables for ImageKit
process.env["IMAGEKIT_PRIVATE_KEY"] = "test-private-key";
process.env["IMAGEKIT_PUBLIC_KEY"] = "test-public-key";

/**
 * Tests for DELETE /me/image (delete profile image).
 * Served at /api/profiles/me/image via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 *
 * Tests verify ImageKit deletion, Firestore updates, and error handling.
 */
describe("DELETE /:slug/image (delete profile image)", () => {
  interface SetupOptions {
    // Request parameters
    slug?: string;
    authToken?: string | null;

    // Scenario flags
    memberHasNoSlug?: boolean;
    memberHasNoImage?: boolean;
    imagekitDeleteFails?: boolean;
    unexpectedError?: boolean;
  }

  function setup({
    slug = "test-user",
    authToken = "valid-token",
    memberHasNoSlug = false,
    memberHasNoImage = false,
    imagekitDeleteFails = false,
    unexpectedError = false,
  }: SetupOptions = {}) {
    // Mock ImageKit deleteFile
    const mockDeleteFile = mock(() => {
      if (imagekitDeleteFails) {
        throw new Error("ImageKit deletion failed");
      }
      return Promise.resolve();
    });

    // Mock getImageKitClient to return mocked ImageKit instance
    void mock.module("../utils/imagekit-client.js", () => ({
      getImageKitClient: () => ({
        deleteFile: mockDeleteFile,
      }),
    }));

    // Mock MemberFirestoreService updateMember
    const mockUpdateMember = mock(() => Promise.resolve());

    void mock.module(
      "../../shared-api/services/member-firestore/index.js",
      () => ({
        MemberFirestoreService: {
          updateMember: mockUpdateMember,
        },
      }),
    );

    // Configure member service mocks
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

    const mockGetMemberBySlug = mock(() => {
      if (memberHasNoImage) {
        const memberDocumentWithoutImage = { ...mockMemberDocument };
        delete memberDocumentWithoutImage.imagekitFileId;
        delete memberDocumentWithoutImage.imagekitPath;
        return Promise.resolve(memberDocumentWithoutImage);
      }
      return Promise.resolve(mockMemberDocument);
    });

    const testApp = createProfilesTestPlugin({
      profileMemberService: {
        verifyActiveMembership: mockVerifyMembership,
        getMemberBySlug: mockGetMemberBySlug,
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

    return {
      testApp,
      request,
      mockDeleteFile,
      mockUpdateMember,
      mockGetMemberBySlug,
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
    it("should delete image from ImageKit and clear Firestore fields", async () => {
      const { testApp, request, mockDeleteFile, mockUpdateMember } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);

      // Verify ImageKit deleteFile was called with correct fileId
      expect(mockDeleteFile).toHaveBeenCalledWith("test-imagekit-file-id");

      // Verify Firestore update was called
      expect(mockUpdateMember).toHaveBeenCalled();
    });

    it("should succeed when profile has no image (imagekitFileId is undefined)", async () => {
      const {
        testApp,
        request,
        mockDeleteFile,
        mockUpdateMember,
        mockGetMemberBySlug,
      } = setup({
        memberHasNoImage: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);

      // Verify getMemberBySlug was called
      expect(mockGetMemberBySlug).toHaveBeenCalled();

      // Verify ImageKit deleteFile was NOT called
      expect(mockDeleteFile).not.toHaveBeenCalled();

      // Verify Firestore update was NOT called
      expect(mockUpdateMember).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should return 500 when ImageKit deletion fails", async () => {
      const { testApp, request, mockUpdateMember } = setup({
        imagekitDeleteFails: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("delete profile image");

      // Verify Firestore update was NOT called since ImageKit deletion failed
      expect(mockUpdateMember).not.toHaveBeenCalled();
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
