import { describe, expect, it, mock } from "bun:test";
import type { ReferralPortalSettings } from "../../shared-api/services/referral-portal-settings/interface.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createAdminSettingsTestPlugin } from "../test-utils/create-admin-settings-test-plugin.js";

/**
 * Tests for PATCH /referral-portal.
 * Served at /api/admin/settings/referral-portal via Firebase rewrite.
 */
describe("PATCH /referral-portal (flip Referral Portal v2 switch)", () => {
  interface SetupOptions {
    body?: unknown;
    authToken?: string | null;
    serviceFailure?: boolean;
  }

  function setup({
    body = { v2Enabled: true },
    authToken = "admin-token",
    serviceFailure = false,
  }: SetupOptions = {}) {
    const mockUpdate = mock(
      ({
        v2Enabled,
        updatedBy,
      }: {
        v2Enabled: boolean;
        updatedBy: string;
      }): Promise<ReferralPortalSettings> =>
        serviceFailure
          ? Promise.reject(new Error("Firestore unavailable"))
          : Promise.resolve({
              v2Enabled,
              updatedAt: "2026-11-22T12:00:00.000Z",
              updatedBy,
            }),
    );

    const testApp = createAdminSettingsTestPlugin({
      referralPortalSettingsService: {
        updateReferralPortalSettings: mockUpdate,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/referral-portal", {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request, mockUpdate };
  }

  describe("Authentication", () => {
    it("returns 401 when no authorization header is provided", async () => {
      const { testApp, request, mockUpdate } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns 403 and does not write when a non-admin flips the switch", async () => {
      const { testApp, request, mockUpdate } = setup({
        authToken: "non-admin-token",
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Success", () => {
    it("turns the switch on and records the Admin who flipped it", async () => {
      const { testApp, request, mockUpdate } = setup({
        body: { v2Enabled: true },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        v2Enabled: true,
        updatedAt: "2026-11-22T12:00:00.000Z",
        updatedBy: "admin-user",
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        v2Enabled: true,
        updatedBy: "admin-user",
      });
    });

    it("turns the switch off", async () => {
      const { testApp, request } = setup({ body: { v2Enabled: false } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as ReferralPortalSettings;
      expect(body.v2Enabled).toBe(false);
    });
  });

  describe("Validation", () => {
    it("returns 422 when v2Enabled is missing", async () => {
      const { testApp, request, mockUpdate } = setup({ body: {} });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns 422 when v2Enabled is not a boolean", async () => {
      const { testApp, request } = setup({ body: { v2Enabled: "yes" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when the settings write fails", async () => {
      const { testApp, request } = setup({ serviceFailure: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
    });
  });
});
