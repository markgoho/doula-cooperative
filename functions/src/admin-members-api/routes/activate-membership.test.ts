import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /admin/members/:memberId/membership/activate.
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /admin/members/:memberId/membership/activate", () => {
  const mockActivateMembership = mock(
    (memberId: string): Promise<MemberDocument> => {
      if (memberId === "non-existent-id") {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      return Promise.resolve({
        uid: memberId,
        email: "test@example.com",
        createdAt: Timestamp.now(),
        membershipActive: true,
        subscriptionStart: Timestamp.now(),
        membershipExpiresAt: Timestamp.now(),
      });
    },
  );

  const testApp = createAdminTestPlugin({
    memberAdminService: {
      activateMembership: mockActivateMembership,
    },
  });

  beforeEach(() => {
    mockActivateMembership.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/activate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        ),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to activate", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/activate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer non-admin-token",
            },
            body: JSON.stringify({}),
          },
        ),
      )) as Response;

      expect(response.status).toBe(403);
    });
  });

  describe("Activation with default dates", () => {
    it("should activate membership with default dates when no dates provided", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/activate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
            body: JSON.stringify({}),
          },
        ),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { membershipActive?: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.member?.membershipActive).toBe(true);
    });
  });

  describe("Activation with custom dates", () => {
    it("should accept optional subscriptionStart and membershipExpiresAt", async () => {
      const startDate = "2025-01-01T00:00:00.000Z";
      const expiresDate = "2026-01-01T00:00:00.000Z";

      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/activate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
            body: JSON.stringify({
              subscriptionStart: startDate,
              membershipExpiresAt: expiresDate,
            }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(200);
      expect(mockActivateMembership).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent member", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/non-existent-id/membership/activate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
            body: JSON.stringify({}),
          },
        ),
      )) as Response;

      expect(response.status).toBe(404);
    });
  });
});
