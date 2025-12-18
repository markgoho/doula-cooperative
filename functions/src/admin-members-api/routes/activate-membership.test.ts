import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/membership/activate.
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /:memberId/membership/activate", () => {
  interface SetupOptions {
    // Request parameters
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
  }

  function setup({
    body = {},
    memberId = "test-id",
    authToken = "admin-token",
    memberNotFound = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockActivateMembership = mock(
      (id: string): Promise<MemberDocument> => {
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        return Promise.resolve({
          uid: id,
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

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/membership/activate`,
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

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to activate", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
    });
  });

  describe("Activation with default dates", () => {
    it("should activate membership with default dates when no dates provided", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

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

      const { testApp, request } = setup({
        body: {
          subscriptionStart: startDate,
          membershipExpiresAt: expiresDate,
        },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent member", async () => {
      const { testApp, request } = setup({
        memberId: "non-existent-id",
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
    });
  });
});
