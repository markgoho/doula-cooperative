import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /:memberId (get single member).
 * Served at /api/admin/members/:memberId via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("GET /:memberId (get member)", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    serverError?: boolean;
  }

  function setup({
    memberId = "member-1",
    authToken = "admin-token",
    memberNotFound = false,
    serverError = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockVerifyMemberExists = mock(() => {
      if (serverError) {
        return Promise.reject(new Error("Database connection timeout"));
      }
      if (memberNotFound) {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      // Success - return mock member
      return Promise.resolve({
        uid: memberId,
        email: "member1@example.com",
        createdAt: Timestamp.now(),
        name: "Member One",
        membershipActive: true,
        subscriptionStart: Timestamp.now(),
        membershipExpiresAt: Timestamp.now(),
      } as MemberDocument);
    });

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        verifyMemberExists: mockVerifyMemberExists,
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

      const response = await testApp.handle(request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });

    it("should allow admin to get member", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Member retrieval", () => {
    it("should return 404 when member does not exist", async () => {
      const { testApp, request } = setup({
        memberId: "nonexistent-member",
        memberNotFound: true,
      });

      const response = await testApp.handle(request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await testApp.handle(request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("Database connection");
      expect(body.error).toContain("get member");
    });
  });

  describe("Response format", () => {
    it("should return member data", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        uid?: string;
        email?: string;
        name?: string;
        membershipActive?: boolean;
      };
      expect(body.uid).toBe("member-1");
      expect(body.email).toBe("member1@example.com");
      expect(body.name).toBe("Member One");
      expect(body.membershipActive).toBe(true);
    });

    it("should convert Timestamp fields to ISO strings", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      const body = (await response.json()) as {
        createdAt?: string;
        subscriptionStart?: string;
        membershipExpiresAt?: string;
      };
      expect(body.createdAt).toBeDefined();
      expect(typeof body.createdAt).toBe("string");
      // Verify it's a valid ISO 8601 date
      expect(() => new Date(body.createdAt ?? "")).not.toThrow();

      expect(typeof body.subscriptionStart).toBe("string");
      expect(typeof body.membershipExpiresAt).toBe("string");
    });
  });
});
