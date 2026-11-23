import { describe, expect, it, mock } from "bun:test";
import type { ReferralPortalSettings } from "../../shared-api/services/referral-portal-settings/interface.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createAdminSettingsTestPlugin } from "../test-utils/create-admin-settings-test-plugin.js";

/**
 * Tests for GET /referral-portal.
 * Served at /api/admin/settings/referral-portal via Firebase rewrite.
 */
describe("GET /referral-portal (read Referral Portal v2 switch)", () => {
  interface SetupOptions {
    authToken?: string | null;
    settings?: ReferralPortalSettings;
    serviceFailure?: boolean;
  }

  function setup({
    authToken = "admin-token",
    settings = { v2Enabled: false },
    serviceFailure = false,
  }: SetupOptions = {}) {
    const testApp = createAdminSettingsTestPlugin({
      referralPortalSettingsService: {
        getReferralPortalSettings: mock(() =>
          serviceFailure
            ? Promise.reject(new Error("Firestore unavailable"))
            : Promise.resolve(settings),
        ),
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/referral-portal", {
      headers,
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("returns 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("returns 403 when a non-admin reads the switch", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Success", () => {
    it("returns off with no history when the switch was never set", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ v2Enabled: false });
    });

    it("returns the stored switch state with who flipped it and when", async () => {
      const settings = {
        v2Enabled: true,
        updatedAt: "2026-11-20T15:30:00.000Z",
        updatedBy: "admin-user",
      };
      const { testApp, request } = setup({ settings });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(settings);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when the settings read fails", async () => {
      const { testApp, request } = setup({ serviceFailure: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
    });
  });
});
