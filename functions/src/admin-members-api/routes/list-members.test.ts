import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET / (list with pagination).
 * Served at /api/admin/members/ via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET / (list members)", () => {
  const mockMembers: MemberDocument[] = [
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
  ];

  const mockListMembers = mock(() => {
    return Promise.resolve({
      members: mockMembers,
      total: 2,
    });
  });

  const testApp = createAdminTestPlugin({
    memberAdminService: {
      listMembers: mockListMembers,
    },
  });

  beforeEach(() => {
    mockListMembers.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer non-admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });

    it("should allow admin to list members", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Service invocation", () => {
    it("should call service with logger", async () => {
      await testApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      );

      expect(mockListMembers).toHaveBeenCalledTimes(1);
      expect(mockListMembers).toHaveBeenCalledWith({
        logger: expect.any(Object) as unknown,
      });
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const mockUnexpectedError = mock(() => {
        return Promise.reject(new Error("Firestore quota exceeded"));
      });

      const errorTestApp = createAdminTestPlugin({
        memberAdminService: {
          listMembers: mockUnexpectedError,
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

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
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        members?: unknown[];
        total?: number;
      };
      expect(Array.isArray(body.members)).toBe(true);
      expect(body.members?.length).toBe(2);
      expect(body.total).toBe(10);
    });

    it("should convert Timestamp fields to ISO strings", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

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
