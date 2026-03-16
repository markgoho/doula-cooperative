import { handleRequest } from "@doula-coop/functions-shared/test-utils/handle-request.js";
import { describe, expect, it } from "bun:test";
import { createApp } from "../app.js";

function setup() {
  const testApp = createApp();

  // Health endpoint is at /api/members/health (with prefix)
  const request = new Request("http://localhost/api/members/health", {
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

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
  });

  it("should return ok status in body", async () => {
    const { testApp, request } = setup();

    const response = await handleRequest(testApp, request);
    const body = (await response.json()) as { status: string };

    expect(body.status).toBe("ok");
  });

  it("should not require authentication", async () => {
    const { testApp, request } = setup();

    // Explicitly no Authorization header
    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
