import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { MatchRequestResponse } from "../schemas/match-request-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /:requestId (get single match request).
 * Served at /api/admin/match-requests/:requestId via Firebase rewrite.
 */
describe("GET /:requestId (get match request)", () => {
  const mockRequest: MatchRequestResponse = {
    id: "request-123",
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

  const mockGetMatchRequest = mock(() => Promise.resolve(mockRequest));

  const testApp = createAdminTestPlugin({
    matchRequestAdminService: {
      getMatchRequest: mockGetMatchRequest,
    },
  });

  beforeEach(() => {
    mockGetMatchRequest.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          headers: {
            Authorization: "Bearer non-admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Success Scenarios", () => {
    it("should return match request when found", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      expect(mockGetMatchRequest).toHaveBeenCalledTimes(1);

      const body = (await response.json()) as MatchRequestResponse;
      expect(body).toEqual(mockRequest);
    });
  });

  describe("Error Scenarios", () => {
    it("should return 404 when match request not found", async () => {
      const notFoundApp = createAdminTestPlugin({
        matchRequestAdminService: {
          getMatchRequest: mock(() => {
            throw new NotFoundError("Match request not found");
          }),
        },
      });

      const response = (await notFoundApp.handle(
        new Request("http://localhost/nonexistent-id", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Match request not found");
    });
  });
});
