import { describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { MatchRequestResponse } from "../schemas/match-request-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /:requestId (get single match request).
 * Served at /api/admin/match-requests/:requestId via Firebase rewrite.
 */
describe("GET /:requestId (get match request)", () => {
  interface SetupOptions {
    // Request parameters
    requestId?: string;
    authToken?: string | null;

    // Scenario flags
    requestNotFound?: boolean;
  }

  function setup({
    requestId = "request-123",
    authToken = "admin-token",
    requestNotFound = false,
  }: SetupOptions = {}) {
    const mockRequest: MatchRequestResponse = {
      id: requestId,
      name: "Test User",
      phone: "555-1234",
      email: "test@example.com",
      zipcode: "12345",
      estimatedDueDate: { month: "03", day: "15", year: "2025" },
      services: ["birth-doula"],
      birthLocation: "Hospital",
      otherInfo: "First time",
      insurance: ["Blue Cross"],
      submitted: new Date().toISOString(),
      sent: false,
    };

    // Configure mock based on scenario
    const mockGetMatchRequest = mock(() => {
      if (requestNotFound) {
        throw new NotFoundError("Match request not found");
      }
      return Promise.resolve(mockRequest);
    });

    const testApp = createAdminTestPlugin({
      matchRequestAdminService: {
        getMatchRequest: mockGetMatchRequest,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${requestId}`, {
      headers,
    });

    return { testApp, request, mockRequest };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await testApp.handle(request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Success Scenarios", () => {
    it("should return match request when found", async () => {
      const { testApp, request, mockRequest } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as MatchRequestResponse;
      expect(body).toEqual(mockRequest);
    });
  });

  describe("Error Scenarios", () => {
    it("should return 404 when match request not found", async () => {
      const { testApp, request } = setup({
        requestId: "nonexistent-id",
        requestNotFound: true,
      });

      const response = await testApp.handle(request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Match request not found");
    });
  });
});
