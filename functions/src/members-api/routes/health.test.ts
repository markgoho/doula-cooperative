import { describe, expect, it } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { app } from "../app.js";

/**
 * Tests for the health check endpoint.
 *
 * Run these tests with:
 *   bun test test/api/health.test.ts
 *
 * Or run all API tests:
 *   bun test test/api/
 */
describe("GET /health", () => {
  // Use the actual app from app.ts - avoids duplicating route definitions in tests
  const api = treaty(app);

  it("should return 200 status", async () => {
    const { status } = await api.health.get();

    expect(status).toBe(200);
  });

  it("should return JSON with status ok", async () => {
    const { data } = await api.health.get();

    expect(data).toEqual({ status: "ok" });
  });

  it("should not require authentication", async () => {
    const { status } = await api.health.get();

    expect(status).toBe(200);
  });
});
