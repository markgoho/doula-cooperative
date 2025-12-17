import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import {
  toUnclaimedProfileResponse,
  type UnclaimedProfileResponse,
} from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /:email (get unclaimed profile).
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET /:email (get unclaimed profile)", () => {
  const mockProfileDocument: UnclaimedProfileDocument = {
    email: "test@example.com",
    name: "Test User",
    slug: "test-user",
    subscriptionStart: Timestamp.now(),
    lastPayment: Timestamp.now(),
    nextPayment: Timestamp.now(),
  };

  const mockProfile = toUnclaimedProfileResponse(mockProfileDocument);

  const mockGetUnclaimedProfile = mock(
    ({ email }: { email: string }): Promise<UnclaimedProfileResponse> => {
      if (email === "nonexistent@example.com") {
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

  beforeEach(() => {
    mockGetUnclaimedProfile.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to get profile", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com", {
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

  describe("Email parameter validation", () => {
    it("should reject invalid email format", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/not-an-email", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid email format", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/valid@example.com", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as UnclaimedProfileResponse;
      expect(body.email).toBe("test@example.com");
    });
  });

  describe("Successful retrieval", () => {
    it("should return profile when authenticated as admin", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as UnclaimedProfileResponse;
      expect(body.email).toBe("test@example.com");
      expect(body.name).toBe("Test User");
      expect(body.slug).toBe("test-user");
      expect(mockGetUnclaimedProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/nonexistent@example.com", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });
  });
});
