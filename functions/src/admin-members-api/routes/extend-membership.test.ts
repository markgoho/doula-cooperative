import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/membership/extend.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/membership/extend", () => {
  interface SetupOptions {
    // Request parameters
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
  }

  function setup({
    body = { newExpirationDate: "2026-01-01T00:00:00.000Z" },
    memberId = "test-id",
    authToken = "admin-token",
    memberNotFound = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockExtendMembership = mock(
      (id: string, newExpirationDate: string): Promise<MemberDocument> => {
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        return Promise.resolve({
          uid: id,
          email: "test@example.com",
          createdAt: Timestamp.now(),
          membershipActive: true,
          membershipExpiresAt: Timestamp.fromDate(new Date(newExpirationDate)),
        });
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        extendMembership: mockExtendMembership,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/membership/extend`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await testApp.handle(request);

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to extend", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(403);
    });
  });

  describe("Input validation", () => {
    it("should require newExpirationDate in request body", async () => {
      const { testApp, request } = setup({ body: {} });

      const response = await testApp.handle(request);

      expect(response.status).toBe(422);
    });

    it("should reject invalid date format", async () => {
      const { testApp, request } = setup({
        body: { newExpirationDate: "not-a-date" },
      });

      const response = await testApp.handle(request);

      expect(response.status).toBe(422);
    });
  });

  describe("Successful extension", () => {
    it("should extend membership with new expiration date", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent member", async () => {
      const { testApp, request } = setup({ memberId: "non-existent-id" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(404);
    });
  });
});
