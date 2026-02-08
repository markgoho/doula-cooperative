import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/membership/deactivate.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/membership/deactivate", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
  }

  function setup({
    memberId = "test-id",
    authToken = "admin-token",
    memberNotFound = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockDeactivateMembership = mock(
      (id: string): Promise<MemberDocument> => {
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        return Promise.resolve({
          uid: id,
          email: "test@example.com",
          createdAt: Timestamp.now(),
          membershipActive: false,
        });
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        deactivateMembership: mockDeactivateMembership,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/membership/deactivate`,
      {
        method: "POST",
        headers,
      },
    );

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to deactivate", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });
  });

  describe("Successful deactivation", () => {
    it("should deactivate membership successfully", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { membershipActive?: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.member?.membershipActive).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent member", async () => {
      const { testApp, request } = setup({ memberId: "non-existent-id" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });
  });
});
