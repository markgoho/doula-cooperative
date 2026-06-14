import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberSignupsResponse } from "../schemas/analytics-schemas.js";
import { createAnalyticsTestPlugin } from "../test-utils/create-analytics-test-plugin.js";

interface SetupOptions {
  authToken?: string | null;
  signupsResult?: MemberSignupsResponse;
}

function setup({
  authToken = "admin-token",
  signupsResult,
}: SetupOptions = {}) {
  const getMemberSignups = mock(() =>
    Promise.resolve(
      signupsResult ?? {
        days: [
          { date: "2026-06-01", count: 3 },
          { date: "2026-06-02", count: 0 },
        ],
      },
    ),
  );

  const testPlugin = createAnalyticsTestPlugin({
    analyticsService: { getMemberSignups },
  });

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const request = new Request("http://localhost/member-signups", { headers });
  return { testPlugin, request, getMemberSignups };
}

describe("GET /member-signups", () => {
  describe("Authentication", () => {
    it("returns 401 with no auth header", async () => {
      const { testPlugin, request } = setup({ authToken: null });
      const response = await handleRequest(testPlugin, request);
      expect(response.status).toBe(401);
    });

    it("returns 403 for non-admin token", async () => {
      const { testPlugin, request } = setup({ authToken: "non-admin-token" });
      const response = await handleRequest(testPlugin, request);
      expect(response.status).toBe(403);
    });

    it("returns 200 for admin token", async () => {
      const { testPlugin, request } = setup();
      const response = await handleRequest(testPlugin, request);
      expect(response.status).toBe(200);
    });
  });

  describe("Response format", () => {
    it("returns days array", async () => {
      const { testPlugin, request } = setup();
      const response = await handleRequest(testPlugin, request);
      const body = (await response.json()) as MemberSignupsResponse;
      expect(Array.isArray(body.days)).toBe(true);
      expect(body.days[0]).toMatchObject({ date: "2026-06-01", count: 3 });
    });

    it("returns empty days when no signups", async () => {
      const { testPlugin, request } = setup({ signupsResult: { days: [] } });
      const response = await handleRequest(testPlugin, request);
      const body = (await response.json()) as MemberSignupsResponse;
      expect(body.days).toHaveLength(0);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when service throws", async () => {
      const getMemberSignups = mock(() =>
        Promise.reject(new Error("Firestore unavailable")),
      );
      const testPlugin = createAnalyticsTestPlugin({
        analyticsService: { getMemberSignups },
      });
      const request = new Request("http://localhost/member-signups", {
        headers: { Authorization: "Bearer admin-token" },
      });
      const response = await handleRequest(testPlugin, request);
      expect(response.status).toBe(500);
    });
  });
});
