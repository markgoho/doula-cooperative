import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for PATCH /:requestId (update match request status).
 * Served at /api/admin/match-requests/:requestId via Firebase rewrite.
 */
describe("PATCH /:requestId (update match request)", () => {
  const mockUpdateMatchRequest = mock(() =>
    Promise.resolve({ success: true as const }),
  );

  const testApp = createAdminTestPlugin({
    matchRequestAdminService: {
      updateMatchRequest: mockUpdateMatchRequest,
    },
  });

  beforeEach(() => {
    mockUpdateMatchRequest.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sent: true }),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer non-admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sent: true }),
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Success Scenarios", () => {
    it("should update match request status when authorized", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sent: true }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      expect(mockUpdateMatchRequest).toHaveBeenCalledTimes(1);

      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should return 422 when body is missing", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when sent field is missing", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when sent is not a boolean", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/request-123", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sent: "not-a-boolean" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Error Scenarios", () => {
    it("should return 404 when match request not found", async () => {
      const notFoundApp = createAdminTestPlugin({
        matchRequestAdminService: {
          updateMatchRequest: mock(() => {
            throw new NotFoundError("Match request not found");
          }),
        },
      });

      const response = (await notFoundApp.handle(
        new Request("http://localhost/nonexistent-id", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sent: true }),
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Match request not found");
    });
  });
});
