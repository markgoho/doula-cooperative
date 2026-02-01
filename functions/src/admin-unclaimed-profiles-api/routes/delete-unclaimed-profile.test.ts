import { describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for DELETE /:email.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("DELETE /:email", () => {
  interface SetupOptions {
    // Request parameters
    email?: string;
    authToken?: string | null;

    // Scenario flags
    profileNotFound?: boolean;
  }

  function setup({
    email = "test@example.com",
    authToken = "admin-token",
    profileNotFound = false,
  }: SetupOptions = {}) {
    const mockDeleteUnclaimedProfile = mock(
      ({
        email: requestEmail,
      }: {
        email: string;
      }): Promise<{ success: true }> => {
        if (profileNotFound || requestEmail === "nonexistent@example.com") {
          return Promise.reject(
            new NotFoundError("Unclaimed profile not found"),
          );
        }
        return Promise.resolve({ success: true });
      },
    );

    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: {
        deleteUnclaimedProfile: mockDeleteUnclaimedProfile,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${email}`, {
      method: "DELETE",
      headers,
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await testApp.handle(request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to delete", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Email parameter validation", () => {
    it("should reject invalid email format", async () => {
      const { testApp, request } = setup({ email: "not-an-email" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(422);
    });

    it("should accept valid email format", async () => {
      const { testApp, request } = setup({ email: "valid@example.com" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Successful deletion", () => {
    it("should delete unclaimed profile when authenticated as admin", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = await testApp.handle(request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });
  });
});
