import { describe, expect, it, mock } from "bun:test";
import {
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for DELETE /:memberId.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("DELETE /:memberId", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    selfDeletion?: boolean;
    deletingAdminUser?: boolean;
    memberNotFound?: boolean;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "admin-token",
    selfDeletion = false,
    deletingAdminUser = false,
    memberNotFound = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockDeleteUser = mock(
      (id: string, requestingAdminUid: string): Promise<void> => {
        if (selfDeletion || id === requestingAdminUid || id === "admin-user") {
          return Promise.reject(
            new ForbiddenError("You cannot delete your own account"),
          );
        }
        if (deletingAdminUser || id === "admin-member-id") {
          return Promise.reject(
            new ForbiddenError(
              "Cannot delete admin users. Remove admin privileges first.",
            ),
          );
        }
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        return Promise.resolve();
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        deleteUser: mockDeleteUser,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}`, {
      method: "DELETE",
      headers,
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

    it("should return 403 when non-admin user tries to delete", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Deletion guards", () => {
    it("should prevent self-deletion", async () => {
      const { testApp, request } = setup({ memberId: "admin-user" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You cannot delete your own account");
    });

    it("should prevent deleting other admin users", async () => {
      const { testApp, request } = setup({ memberId: "admin-member-id" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Cannot delete admin users. Remove admin privileges first.",
      );
    });
  });

  describe("Successful deletion", () => {
    it("should delete user and return success response", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        deletedUid?: string;
      };
      expect(body.success).toBe(true);
      expect(body.deletedUid).toBe("test-member-id");
    });
  });

  describe("Error handling", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberId: "non-existent-id" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });
});
