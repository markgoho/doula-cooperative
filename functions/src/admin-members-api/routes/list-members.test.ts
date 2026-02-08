import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET / (list with pagination).
 * Served at /api/admin/members/ via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("GET / (list members)", () => {
  interface SetupOptions {
    // Request parameters
    authToken?: string | null;

    // Scenario flags
    serverError?: boolean;
  }

  function setup({
    authToken = "admin-token",
    serverError = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockListMembers = mock(() => {
      if (serverError) {
        return Promise.reject(new Error("Firestore quota exceeded"));
      }
      // Success - return mock members
      return Promise.resolve({
        members: [
          {
            uid: "member-1",
            email: "member1@example.com",
            createdAt: Timestamp.now(),
            name: "Member One",
            membershipActive: true,
          },
          {
            uid: "member-2",
            email: "member2@example.com",
            createdAt: Timestamp.now(),
            name: "Member Two",
            membershipActive: false,
          },
        ] as MemberDocument[],
        total: 2,
      });
    });

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        listMembers: mockListMembers,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/", {
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

    it("should return 403 when non-admin user tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });

    it("should allow admin to list members", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("Firestore quota");
      expect(body.error).toContain("list members");
    });
  });

  describe("Response format", () => {
    it("should return members array with total count", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        members?: unknown[];
        total?: number;
      };
      expect(Array.isArray(body.members)).toBe(true);
      expect(body.members?.length).toBe(2);
      expect(body.total).toBe(2);
    });

    it("should convert Timestamp fields to ISO strings", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      const body = (await response.json()) as {
        members?: { createdAt?: string }[];
      };
      expect(body.members?.[0]?.createdAt).toBeDefined();
      expect(typeof body.members?.[0]?.createdAt).toBe("string");
      // Verify it's a valid ISO 8601 date
      expect(() => new Date(body.members?.[0]?.createdAt ?? "")).not.toThrow();
    });
  });
});
