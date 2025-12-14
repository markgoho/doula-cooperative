import { describe, expect, it, beforeEach, mock } from "bun:test";
import { ForbiddenError, NotFoundError } from "../../errors/http-error.js";
import { createAdminTestPlugin } from "../../test-utils/test-app-factory.js";

/**
 * Tests for DELETE /admin/members/:memberId.
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("DELETE /admin/members/:memberId", () => {
  const mockDeleteUser = mock(
    (memberId: string, requestingAdminUid: string): Promise<void> => {
      if (memberId === requestingAdminUid) {
        return Promise.reject(
          new ForbiddenError("You cannot delete your own account"),
        );
      }
      if (memberId === "admin-member-id") {
        return Promise.reject(
          new ForbiddenError(
            "Cannot delete admin users. Remove admin privileges first.",
          ),
        );
      }
      if (memberId === "non-existent-id") {
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

  beforeEach(() => {
    mockDeleteUser.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-id", {
          method: "DELETE",
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to delete", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-id", {
          method: "DELETE",
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

  describe("Deletion guards", () => {
    it("should prevent self-deletion", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/admin-user", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You cannot delete your own account");
    });

    it("should prevent deleting other admin users", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/admin-member-id", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Cannot delete admin users. Remove admin privileges first.",
      );
    });
  });

  describe("Successful deletion", () => {
    it("should delete user and return success response", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-member-id", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        deletedUid?: string;
      };
      expect(body.success).toBe(true);
      expect(body.deletedUid).toBe("test-member-id");
    });

    it("should call deleteUser service with admin UID", async () => {
      await testApp.handle(
        new Request("http://localhost/admin/members/test-member-id", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      );

      expect(mockDeleteUser).toHaveBeenCalledTimes(1);
      expect(mockDeleteUser.mock.calls[0]?.[0]).toBe("test-member-id");
      expect(mockDeleteUser.mock.calls[0]?.[1]).toBe("admin-user");
    });
  });

  describe("Error handling", () => {
    it("should return 404 when member not found", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/non-existent-id", {
          method: "DELETE",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });
});
