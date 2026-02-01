import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import {
  toUnclaimedProfileResponse,
  type UnclaimedProfileSuccessResponse,
} from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /:email (get unclaimed profile).
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("GET /:email (get unclaimed profile)", () => {
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
    const mockProfileDocument: UnclaimedProfileDocument = {
      email,
      name: "Test User",
      slug: "test-user",
      subscriptionStart: Timestamp.now(),
      lastPayment: Timestamp.now(),
      nextPayment: Timestamp.now(),
    };

    const mockProfile = toUnclaimedProfileResponse(mockProfileDocument);

    const mockGetUnclaimedProfile = mock(
      ({
        email: requestEmail,
      }: {
        email: string;
      }): Promise<UnclaimedProfileSuccessResponse> => {
        if (profileNotFound || requestEmail === "nonexistent@example.com") {
          return Promise.reject(new NotFoundError("Profile not found"));
        }
        return Promise.resolve(mockProfile);
      },
    );

    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: {
        getUnclaimedProfile: mockGetUnclaimedProfile,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${email}`, {
      headers,
    });

    return { testApp, request, mockProfile };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await testApp.handle(request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to get profile", async () => {
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
      const { testApp, request, mockProfile } = setup({
        email: "valid@example.com",
      });

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as UnclaimedProfileSuccessResponse;
      expect(body.email).toBe(mockProfile.email);
    });
  });

  describe("Successful retrieval", () => {
    it("should return profile when authenticated as admin", async () => {
      const { testApp, request, mockProfile } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as UnclaimedProfileSuccessResponse;
      expect(body.email).toBe(mockProfile.email);
      expect(body.name).toBe(mockProfile.name);
      expect(body.slug).toBe(mockProfile.slug);
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({
        email: "nonexistent@example.com",
        profileNotFound: true,
      });

      const response = await testApp.handle(request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });
  });
});
