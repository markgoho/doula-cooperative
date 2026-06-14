import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { TopPagesResponse } from "../schemas/analytics-schemas.js";
import { createAnalyticsTestPlugin } from "../test-utils/create-analytics-test-plugin.js";

interface SetupOptions {
  authToken?: string | null;
  result?: TopPagesResponse;
}

function setup({ authToken = "admin-token", result }: SetupOptions = {}) {
  const getTopPages = mock(() =>
    Promise.resolve(
      result ?? {
        pages: [
          { title: "Home", path: "/", views: 500 },
          { title: "Doulas", path: "/doulas/", views: 300 },
        ],
      },
    ),
  );
  const testPlugin = createAnalyticsTestPlugin({
    analyticsService: { getTopPages },
  });
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const request = new Request("http://localhost/top-pages", { headers });
  return { testPlugin, request };
}

describe("GET /top-pages", () => {
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

  it("returns pages array with title/path/views", async () => {
    const { testPlugin, request } = setup();
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as TopPagesResponse;
    expect(body.pages).toHaveLength(2);
    expect(body.pages[0]).toMatchObject({ title: "Home", path: "/", views: 500 });
  });

  it("returns empty pages when none", async () => {
    const { testPlugin, request } = setup({ result: { pages: [] } });
    const response = await handleRequest(testPlugin, request);
    const body = (await response.json()) as TopPagesResponse;
    expect(body.pages).toHaveLength(0);
  });

  it("returns 500 when service throws", async () => {
    const getTopPages = mock(() => Promise.reject(new Error("Pirsch error")));
    const testPlugin = createAnalyticsTestPlugin({
      analyticsService: { getTopPages },
    });
    const request = new Request("http://localhost/top-pages", {
      headers: { Authorization: "Bearer admin-token" },
    });
    const response = await handleRequest(testPlugin, request);
    expect(response.status).toBe(500);
  });
});
