import { describe, expect, it } from "bun:test";
import { createApp } from "../app.js";

function setup() {
  const testApp = createApp();

  // Health endpoint is at /api/profiles/health (with prefix)
  const request = new Request("http://localhost/api/profiles/health", {
    method: "GET",
  });

  return { testApp, request };
}

/**
 * Tests for the public health check endpoint.
 *
 * Health route is registered directly in the app (not through plugin).
 * Tests verify basic connectivity and response structure.
 */
describe("GET /health", () => {
  it("should return 200 status", async () => {
    const { testApp, request } = setup();

    const response = (await testApp.handle(request)) as Response;

    expect(response.status).toBe(200);
  });

  it("should return ok status in body", async () => {
    const { testApp, request } = setup();

    const response = (await testApp.handle(request)) as Response;
    const body = (await response.json()) as { status: string };

    expect(body.status).toBe("ok");
  });

  it("should not require authentication", async () => {
    const { testApp, request } = setup();

    // Explicitly no Authorization header
    const response = (await testApp.handle(request)) as Response;

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
