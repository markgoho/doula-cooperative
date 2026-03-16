import { NotFoundError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { handleRequest } from "@doula-coop/functions-shared/test-utils/handle-request.js";
import { describe, expect, it, mock } from "bun:test";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for PATCH /:requestId (update match request status).
 * Served at /api/admin/match-requests/:requestId via Firebase rewrite.
 */
describe("PATCH /:requestId (update match request)", () => {
  interface SetupOptions {
    // Request parameters
    body?: Record<string, unknown>;
    requestId?: string;
    authToken?: string | null;

    // Scenario flags
    requestNotFound?: boolean;
  }

  function setup({
    body = { sent: true },
    requestId = "request-123",
    authToken = "admin-token",
    requestNotFound = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockUpdateMatchRequest = mock(() => {
      if (requestNotFound) {
        throw new NotFoundError("Match request not found");
      }
      return Promise.resolve({ success: true as const });
    });

    const testApp = createAdminTestPlugin({
      matchRequestAdminService: {
        updateMatchRequest: mockUpdateMatchRequest,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${requestId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Success Scenarios", () => {
    it("should update match request status when authorized", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should return 422 when sent field is missing", async () => {
      const { testApp, request } = setup({ body: {} });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 422 when sent is not a boolean", async () => {
      const { testApp, request } = setup({ body: { sent: "not-a-boolean" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Error Scenarios", () => {
    it("should return 404 when match request not found", async () => {
      const { testApp, request } = setup({
        requestId: "nonexistent-id",
        requestNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Match request not found");
    });
  });
});
