import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../errors/http-error.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { createAdminTestApp } from "../../test-utils/test-app-factory.js";

/**
 * Tests for POST /admin/members/:memberId/membership/deactivate.
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /admin/members/:memberId/membership/deactivate", () => {
  const mockDeactivateMembership = mock(
    (memberId: string): Promise<MemberDocument> => {
      if (memberId === "non-existent-id") {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      return Promise.resolve({
        uid: memberId,
        email: "test@example.com",
        createdAt: Timestamp.now(),
        membershipActive: false,
      });
    },
  );

  const testApp = createAdminTestApp({
    memberAdminService: {
      deactivateMembership: mockDeactivateMembership,
    },
  });

  beforeEach(() => {
    mockDeactivateMembership.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/deactivate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        ),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to deactivate", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/deactivate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer non-admin-token",
            },
          },
        ),
      )) as Response;

      expect(response.status).toBe(403);
    });
  });

  describe("Successful deactivation", () => {
    it("should deactivate membership successfully", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/deactivate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
          },
        ),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { membershipActive?: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.member?.membershipActive).toBe(false);
    });

    it("should call deactivateMembership service with correct ID", async () => {
      await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-member-id/membership/deactivate",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer admin-token",
            },
          },
        ),
      );

      expect(mockDeactivateMembership).toHaveBeenCalledTimes(1);
      expect(mockDeactivateMembership.mock.calls[0]?.[0]).toBe(
        "test-member-id",
      );
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent member", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/non-existent-id/membership/deactivate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
          },
        ),
      )) as Response;

      expect(response.status).toBe(404);
    });
  });
});
