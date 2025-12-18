import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for PATCH /:memberId.
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("PATCH /:memberId", () => {
  interface SetupOptions {
    // Request parameters
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    protectedFieldUpdate?: boolean;
  }

  function setup({
    body = { name: "Updated Name" },
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    protectedFieldUpdate = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockUpdateMember = mock(
      (
        id: string,
        updates: Record<string, unknown>,
      ): Promise<MemberDocument> => {
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        if (protectedFieldUpdate || updates["uid"]) {
          return Promise.reject(
            new ValidationError("Cannot update protected field: uid"),
          );
        }
        // Return success with updated fields
        return Promise.resolve({
          uid: id,
          email:
            typeof updates["email"] === "string"
              ? updates["email"]
              : "test@example.com",
          createdAt: Timestamp.now(),
          name:
            typeof updates["name"] === "string"
              ? updates["name"]
              : "Updated Member",
          membershipActive: true,
        });
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        updateMember: mockUpdateMember,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request, mockUpdateMember };
  }
  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to update", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Input validation", () => {
    it("should reject updates with invalid email format", async () => {
      const { testApp, request } = setup({ body: { email: "not-an-email" } });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject empty name strings", async () => {
      const { testApp, request } = setup({ body: { name: "" } });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject invalid date-time format", async () => {
      const { testApp, request } = setup({
        body: { subscriptionStart: "not-a-date" },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Successful updates", () => {
    it("should update member and return updated document", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { uid?: string; name?: string };
      };
      expect(body.success).toBe(true);
      expect(body.member?.uid).toBe("test-member-id");
      expect(body.member?.name).toBe("Updated Name");
    });

    it("should update multiple fields", async () => {
      const { testApp, request } = setup({
        body: { name: "New Name", email: "new@example.com" },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { name?: string; email?: string };
      };
      expect(body.success).toBe(true);
      expect(body.member?.name).toBe("New Name");
      expect(body.member?.email).toBe("new@example.com");
    });
  });

  describe("Error handling", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberId: "non-existent-id" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });

  describe("Response format", () => {
    it("should convert Timestamp fields to ISO strings", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      const body = (await response.json()) as {
        member?: { createdAt?: string };
      };
      expect(body.member?.createdAt).toBeDefined();
      expect(typeof body.member?.createdAt).toBe("string");
    });
  });
});
