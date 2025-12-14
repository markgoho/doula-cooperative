import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../errors/http-error.js";
import type { MemberDocument } from "../../../types/member-document.js";
import { createAdminTestApp } from "../../test-utils/test-app-factory.js";

/**
 * Tests for POST /admin/members/:memberId/membership/extend.
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /admin/members/:memberId/membership/extend", () => {
  const mockExtendMembership = mock(
    (memberId: string, newExpirationDate: string): Promise<MemberDocument> => {
      if (memberId === "non-existent-id") {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      return Promise.resolve({
        uid: memberId,
        email: "test@example.com",
        createdAt: Timestamp.now(),
        membershipActive: true,
        membershipExpiresAt: Timestamp.fromDate(new Date(newExpirationDate)),
      });
    },
  );

  const testApp = createAdminTestApp({
    memberAdminService: {
      extendMembership: mockExtendMembership,
    },
  });

  beforeEach(() => {
    mockExtendMembership.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/extend",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              newExpirationDate: "2026-01-01T00:00:00.000Z",
            }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to extend", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/extend",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer non-admin-token",
            },
            body: JSON.stringify({
              newExpirationDate: "2026-01-01T00:00:00.000Z",
            }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(403);
    });
  });

  describe("Input validation", () => {
    it("should require newExpirationDate in request body", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/extend",
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

      expect(response.status).toBe(422);
    });

    it("should reject invalid date format", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/extend",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
            body: JSON.stringify({ newExpirationDate: "not-a-date" }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Successful extension", () => {
    it("should extend membership with new expiration date", async () => {
      const newDate = "2026-01-01T00:00:00.000Z";
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-id/membership/extend",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
            body: JSON.stringify({ newExpirationDate: newDate }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it("should call extendMembership service with correct parameters", async () => {
      const newDate = "2026-01-01T00:00:00.000Z";
      await testApp.handle(
        new Request(
          "http://localhost/admin/members/test-member-id/membership/extend",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
            body: JSON.stringify({ newExpirationDate: newDate }),
          },
        ),
      );

      expect(mockExtendMembership).toHaveBeenCalledTimes(1);
      expect(mockExtendMembership.mock.calls[0]?.[0]).toBe("test-member-id");
      expect(mockExtendMembership.mock.calls[0]?.[1]).toBe(newDate);
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent member", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/admin/members/non-existent-id/membership/extend",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer admin-token",
            },
            body: JSON.stringify({
              newExpirationDate: "2026-01-01T00:00:00.000Z",
            }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(404);
    });
  });
});
