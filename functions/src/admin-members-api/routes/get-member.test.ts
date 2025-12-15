import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../types/member-document.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /:memberId (get single member).
 * Served at /api/admin/members/:memberId via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET /:memberId (get member)", () => {
  const mockMember: MemberDocument = {
    uid: "member-1",
    email: "member1@example.com",
    createdAt: Timestamp.now(),
    name: "Member One",
    membershipActive: true,
    subscriptionStart: Timestamp.now(),
    membershipExpiresAt: Timestamp.now(),
  };

  const mockVerifyMemberExists = mock(() => {
    return Promise.resolve(mockMember);
  });

  const testApp = createAdminTestPlugin({
    memberAdminService: {
      verifyMemberExists: mockVerifyMemberExists,
    },
  });

  beforeEach(() => {
    mockVerifyMemberExists.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/member-1"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/member-1", {
          headers: {
            Authorization: "Bearer non-admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });

    it("should allow admin to get member", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/member-1", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Member retrieval", () => {
    it("should call verifyMemberExists with correct memberId", async () => {
      await testApp.handle(
        new Request("http://localhost/test-member-123", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      );

      expect(mockVerifyMemberExists).toHaveBeenCalledTimes(1);
      expect(mockVerifyMemberExists).toHaveBeenCalledWith("test-member-123");
    });

    it("should return 404 when member does not exist", async () => {
      const mockNotFound = mock(() => {
        return Promise.reject(new NotFoundError("Member not found"));
      });

      const notFoundTestApp = createAdminTestPlugin({
        memberAdminService: {
          verifyMemberExists: mockNotFound,
        },
      });

      const response = (await notFoundTestApp.handle(
        new Request("http://localhost/nonexistent-member", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const mockUnexpectedError = mock(() => {
        return Promise.reject(new Error("Database connection timeout"));
      });

      const errorTestApp = createAdminTestPlugin({
        memberAdminService: {
          verifyMemberExists: mockUnexpectedError,
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/member-1", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

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
      const response = (await testApp.handle(
        new Request("http://localhost/member-1", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

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
      const response = (await testApp.handle(
        new Request("http://localhost/member-1", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

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
