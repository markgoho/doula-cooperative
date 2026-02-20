import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { RefreshPaymentDatesSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /refresh-payment-dates (bulk refresh stale payment dates).
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /refresh-payment-dates", () => {
  interface SetupOptions {
    authToken?: string | null;
    serviceError?: boolean;
    updatedCount?: number;
    totalCount?: number;
  }

  function setup({
    authToken = "admin-token",
    serviceError = false,
    updatedCount = 5,
    totalCount = 12,
  }: SetupOptions = {}) {
    const mockRefreshPaymentDates = mock(() => {
      if (serviceError) {
        return Promise.reject(new Error("Firestore batch write failed"));
      }
      return Promise.resolve({
        success: true,
        updatedCount,
        totalCount,
      } as RefreshPaymentDatesSuccessResponse);
    });

    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: {
        refreshPaymentDates: mockRefreshPaymentDates,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/refresh-payment-dates", {
      method: "POST",
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

    it("should return 403 when non-admin tries to refresh", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful refresh", () => {
    it("should return 200 with updatedCount and totalCount", async () => {
      const { testApp, request } = setup({
        updatedCount: 5,
        totalCount: 12,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body =
        (await response.json()) as RefreshPaymentDatesSuccessResponse;
      expect(body.success).toBe(true);
      expect(body.updatedCount).toBe(5);
      expect(body.totalCount).toBe(12);
    });

    it("should return 200 with zero updates when no profiles need refreshing", async () => {
      const { testApp, request } = setup({
        updatedCount: 0,
        totalCount: 10,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body =
        (await response.json()) as RefreshPaymentDatesSuccessResponse;
      expect(body.success).toBe(true);
      expect(body.updatedCount).toBe(0);
      expect(body.totalCount).toBe(10);
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const { testApp, request } = setup({ serviceError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
    });
  });
});
