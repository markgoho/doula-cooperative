import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MatchRequestLocationsResponse } from "../schemas/analytics-schemas.js";
import { createAnalyticsTestPlugin } from "../test-utils/create-analytics-test-plugin.js";

interface SetupOptions {
  authToken?: string | null;
  result?: MatchRequestLocationsResponse;
}

function setup({ authToken = "admin-token", result }: SetupOptions = {}) {
  const getMatchRequestLocations = mock(() =>
    Promise.resolve(
      result ?? {
        locations: [
          {
            zip: "14620",
            city: "Rochester",
            state: "NY",
            lat: 43.13,
            lng: -77.61,
            count: 4,
          },
        ],
        unmapped: 1,
      },
    ),
  );
  const testPlugin = createAnalyticsTestPlugin({
    analyticsService: { getMatchRequestLocations },
  });
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const request = new Request("http://localhost/match-request-locations", {
    headers,
  });
  return { testPlugin, request };
}

describe("GET /match-request-locations", () => {
  it("returns 401 with no auth", async () => {
    const { testPlugin, request } = setup({ authToken: null });
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { testPlugin, request } = setup({ authToken: "non-admin-token" });
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(403);
  });

  it("returns locations and unmapped count", async () => {
    const { testPlugin, request } = setup();
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as MatchRequestLocationsResponse;
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0]?.zip).toBe("14620");
    expect(body.unmapped).toBe(1);
  });

  it("returns empty when no match requests", async () => {
    const { testPlugin, request } = setup({
      result: { locations: [], unmapped: 0 },
    });
    const response = await handleRequest(testPlugin, request);
    const body = (await response.json()) as MatchRequestLocationsResponse;
    expect(body.locations).toHaveLength(0);
    expect(body.unmapped).toBe(0);
  });

  it("returns 500 when service throws", async () => {
    const getMatchRequestLocations = mock(() =>
      Promise.reject(new Error("Firestore error")),
    );
    const testPlugin = createAnalyticsTestPlugin({
      analyticsService: { getMatchRequestLocations },
    });
    const request = new Request("http://localhost/match-request-locations", {
      headers: { Authorization: "Bearer admin-token" },
    });
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(500);
  });
});
