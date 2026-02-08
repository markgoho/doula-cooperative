import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

/**
 * Tests for the authenticated members endpoint.
 *
 * Uses createMembersTestPlugin() factory with mocked services.
 * Tests only the members plugin in isolation - no full app composition needed.
 */
describe("GET /:memberId (authenticated)", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    serverError?: boolean;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    memberNotFound = false,
    serverError = false,
  }: SetupOptions = {}) {
    // Configure mocks based on scenario
    const mockFindById = mock((id: string): Promise<MemberDocument> => {
      if (serverError) {
        throw new Error("Database connection timeout");
      }
      if (memberNotFound || id !== "test-member-id") {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      return Promise.resolve({
        uid: id,
        email: "test@example.com",
        createdAt: Timestamp.now(),
        name: "Test Member",
        membershipActive: true,
      });
    });

    const mockVerifyOwnerOrAdmin = mock(
      (
        authorizationHeader: string | undefined,
        targetMemberId: string,
      ): Promise<DecodedIdToken> => {
        if (!authorizationHeader) {
          return Promise.reject(new AuthError("Missing Authorization header"));
        }

        if (
          authorizationHeader === "Bearer valid-owner-token" &&
          targetMemberId === "test-member-id"
        ) {
          return Promise.resolve({
            uid: "test-member-id",
            email: "test@example.com",
          } as DecodedIdToken);
        }

        if (authorizationHeader === "Bearer admin-token") {
          return Promise.resolve({
            uid: "admin-user",
            email: "admin@example.com",
            admin: true,
          } as unknown as DecodedIdToken);
        }

        if (authorizationHeader === "Bearer non-owner-token") {
          return Promise.reject(
            new ForbiddenError("You can only access your own data"),
          );
        }

        return Promise.reject(new AuthError("Invalid authentication token"));
      },
    );

    const testApp = createMembersTestPlugin({
      memberService: {
        findById: mockFindById,
      },
      authService: {
        verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}`, {
      headers,
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

    it("should return 403 when non-owner tries to access member data", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You can only access your own data");
    });

    it("should allow owner to access their own member data", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as MemberDocument;
      expect(body.uid).toBe("test-member-id");
    });

    it("should allow admin to access any member data", async () => {
      const { testApp, request } = setup({ authToken: "admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as MemberDocument;
      expect(body.uid).toBe("test-member-id");
    });
  });

  describe("Valid member ID", () => {
    it("should return member data when member exists", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as MemberDocument;
      expect(body.uid).toBe("test-member-id");
      expect(body.name).toBe("Test Member");
    });

    it("should return 404 when member does not exist", async () => {
      const { testApp, request } = setup({
        memberId: "non-existent-id",
        authToken: "admin-token",
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });

  describe("Input validation", () => {
    it("should reject empty member ID", async () => {
      const { testApp } = setup();

      const request = new Request("http://localhost/");
      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    it("should reject member IDs longer than 128 characters", async () => {
      const { testApp } = setup();

      const longId = "a".repeat(129);
      const request = new Request(`http://localhost/${longId}`);
      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Edge cases", () => {
    it("should reject member IDs with URL-encoded forward slashes", async () => {
      const { testApp } = setup({ authToken: "admin-token" });

      const request = new Request("http://localhost/user%2Fwith%2Fslash", {
        headers: { Authorization: "Bearer admin-token" },
      });
      const response = await handleRequest(testApp, request);

      // Forward slashes are not valid in Firestore document IDs
      expect(response.status).toBe(404);
    });
  });

  describe("Response format", () => {
    it("should return JSON content type", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });
  });

  describe("Error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to retrieve member data");
    });
  });
});
