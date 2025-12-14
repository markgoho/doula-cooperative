import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../../types/member-document.js";
import { createAdminTestPlugin } from "../../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /admin/members (list with pagination).
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET /admin/members", () => {
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
      total: 10,
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
        new Request("http://localhost/admin/members"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members", {
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
        new Request("http://localhost/admin/members", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Pagination", () => {
    it("should use default pagination when no query params provided", async () => {
      await testApp.handle(
        new Request("http://localhost/admin/members", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      );

      // Should call service with no limit/offset (defaults handled by service)
      expect(mockListMembers).toHaveBeenCalledTimes(1);
      expect(mockListMembers).toHaveBeenCalledWith({
        logger: expect.any(Object) as unknown,
      });
    });

    it("should pass limit and offset to service", async () => {
      await testApp.handle(
        new Request("http://localhost/admin/members?limit=25&offset=10", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      );

      expect(mockListMembers).toHaveBeenCalledWith({
        limit: 25,
        offset: 10,
        logger: expect.any(Object) as unknown,
      });
    });

    it("should reject limit greater than 100", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members?limit=101", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject negative offset", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members?offset=-1", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return pagination metadata with hasNext flag", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members?limit=2&offset=0", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        pagination?: { limit: number; offset: number; hasNext: boolean };
      };
      expect(body.pagination).toBeDefined();
      expect(body.pagination?.limit).toBe(2);
      expect(body.pagination?.offset).toBe(0);
      expect(body.pagination?.hasNext).toBe(true); // 0 + 2 < 10
    });
  });

  describe("Response format", () => {
    it("should return members array with total count", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members", {
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
        new Request("http://localhost/admin/members", {
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
