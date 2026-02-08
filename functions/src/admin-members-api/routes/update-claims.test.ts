import { describe, expect, it, mock } from "bun:test";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for PATCH /:memberId/claims.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("PATCH /:memberId/claims", () => {
  interface SetupOptions {
    // Request parameters
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    selfModification?: boolean;
    memberNotFound?: boolean;
    invalidUidFormat?: boolean;
  }

  function setup({
    body = { admin: true },
    memberId = "target-user-id",
    authToken = "admin-token",
    selfModification = false,
    memberNotFound = false,
    invalidUidFormat = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockUpdateClaims = mock(
      ({
        uid,
        claims,
        requestingAdminUid,
      }: {
        uid: string;
        claims: { admin?: boolean };
        requestingAdminUid: string;
        logger: unknown;
      }): Promise<void> => {
        if (
          (selfModification && claims.admin !== undefined) ||
          (uid === requestingAdminUid && claims.admin !== undefined) ||
          (uid === "admin-user" && claims.admin !== undefined)
        ) {
          return Promise.reject(
            new ForbiddenError("Cannot modify your own admin privileges"),
          );
        }
        if (memberNotFound || uid === "non-existent-id") {
          return Promise.reject(new NotFoundError("User not found"));
        }
        if (invalidUidFormat || uid === "invalid-uid-format") {
          return Promise.reject(new ValidationError("Invalid user ID format"));
        }
        return Promise.resolve();
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        updateClaims: mockUpdateClaims,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/claims`, {
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

    it("should return 403 when non-admin user tries to update claims", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Updating claims", () => {
    it("should successfully grant admin claim", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        uid?: string;
      };
      expect(body.success).toBe(true);
      expect(body.uid).toBe("target-user-id");
    });

    it("should successfully revoke admin claim", async () => {
      const { testApp, request } = setup({ body: { admin: false } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        uid?: string;
      };
      expect(body.success).toBe(true);
      expect(body.uid).toBe("target-user-id");
    });

    it("should prevent self-modification of admin claim", async () => {
      const { testApp, request } = setup({
        memberId: "admin-user",
        body: { admin: false },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Cannot modify your own admin privileges");
    });

    it("should return 404 when user does not exist", async () => {
      const { testApp, request } = setup({ memberId: "non-existent-id" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("User not found");
    });

    it("should return 400 when UID format is invalid", async () => {
      const { testApp, request } = setup({ memberId: "invalid-uid-format" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid user ID format");
    });

    it("should handle empty body (no claims to update)", async () => {
      const { testApp, request } = setup({ body: {} });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        uid?: string;
      };
      expect(body.success).toBe(true);
      expect(body.uid).toBe("target-user-id");
    });
  });
});
