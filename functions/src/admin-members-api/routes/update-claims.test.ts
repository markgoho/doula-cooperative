import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for PATCH /:memberId/claims.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("PATCH /:memberId/claims", () => {
  const mockUpdateClaims = mock(
    ({
      uid,
      claims,
      requestingAdminUid,
    }: {
      uid: string;
      claims: { admin?: boolean };
      requestingAdminUid: string;
    }): Promise<void> => {
      if (uid === requestingAdminUid && claims.admin !== undefined) {
        return Promise.reject(
          new ForbiddenError("Cannot modify your own admin privileges"),
        );
      }
      if (uid === "non-existent-id") {
        return Promise.reject(new NotFoundError("User not found"));
      }
      if (uid === "invalid-uid-format") {
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

  beforeEach(() => {
    mockUpdateClaims.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-id/claims", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ admin: true }),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to update claims", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-id/claims", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer non-admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ admin: true }),
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Updating claims", () => {
    it("should successfully grant admin claim", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/target-user-id/claims", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ admin: true }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        uid?: string;
      };
      expect(body.success).toBe(true);
      expect(body.uid).toBe("target-user-id");
    });

    it("should successfully revoke admin claim", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/target-user-id/claims", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ admin: false }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        uid?: string;
      };
      expect(body.success).toBe(true);
      expect(body.uid).toBe("target-user-id");
    });

    it("should prevent self-modification of admin claim", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin-user/claims", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ admin: false }),
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Cannot modify your own admin privileges");
    });

    it("should return 404 when user does not exist", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/non-existent-id/claims", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ admin: true }),
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("User not found");
    });

    it("should return 400 when UID format is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/invalid-uid-format/claims", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ admin: true }),
        }),
      )) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid user ID format");
    });

    it("should handle empty body (no claims to update)", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/target-user-id/claims", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      )) as Response;

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
