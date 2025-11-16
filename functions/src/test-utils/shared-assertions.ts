import { expect } from "bun:test";
import type { MockResponse } from "./mock-response.js";

/**
 * Assert that CORS headers are set correctly on response
 */
export function assertCorsHeaders(mockResponse: MockResponse) {
  expect(mockResponse.headers["Access-Control-Allow-Origin"]).toBe("*");
  expect(mockResponse.headers["Access-Control-Allow-Methods"]).toBe("POST");
  expect(mockResponse.headers["Access-Control-Allow-Headers"]).toBe(
    "Content-Type",
  );
}

/**
 * Assert that response has success status
 */
export function assertSuccessStatus(mockResponse: MockResponse) {
  expect(mockResponse.statusCode).toBe(200);
}

