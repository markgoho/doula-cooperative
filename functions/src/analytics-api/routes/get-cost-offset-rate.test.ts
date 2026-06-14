import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { CostOffsetRateResponse } from "../schemas/analytics-schemas.js";
import { createAnalyticsTestPlugin } from "../test-utils/create-analytics-test-plugin.js";

interface SetupOptions {
  authToken?: string | null;
  result?: CostOffsetRateResponse;
}

function setup({ authToken = "admin-token", result }: SetupOptions = {}) {
  const getCostOffsetRate = mock(() =>
    Promise.resolve(result ?? { withOffset: 5, total: 10, rate: 0.5 }),
  );
  const testPlugin = createAnalyticsTestPlugin({
    analyticsService: { getCostOffsetRate },
  });
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const request = new Request("http://localhost/cost-offset-rate", { headers });
  return { testPlugin, request };
}

describe("GET /cost-offset-rate", () => {
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

  it("returns withOffset, total, rate", async () => {
    const { testPlugin, request } = setup();
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as CostOffsetRateResponse;
    expect(body.withOffset).toBe(5);
    expect(body.total).toBe(10);
    expect(body.rate).toBe(0.5);
  });

  it("returns zeros when no match requests", async () => {
    const { testPlugin, request } = setup({
      result: { withOffset: 0, total: 0, rate: 0 },
    });
    const response = await handleRequest(testPlugin, request);
    const body = (await response.json()) as CostOffsetRateResponse;
    expect(body.total).toBe(0);
    expect(body.rate).toBe(0);
  });

  it("returns 500 when service throws", async () => {
    const getCostOffsetRate = mock(() =>
      Promise.reject(new Error("Firestore error")),
    );
    const testPlugin = createAnalyticsTestPlugin({
      analyticsService: { getCostOffsetRate },
    });
    const request = new Request("http://localhost/cost-offset-rate", {
      headers: { Authorization: "Bearer admin-token" },
    });
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(500);
  });
});
