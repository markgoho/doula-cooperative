import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";
import { toUnclaimedProfileResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET / (list unclaimed profiles).
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET / (list unclaimed profiles)", () => {
  const mockProfileDocument: UnclaimedProfileDocument = {
    email: "test@example.com",
    name: "Test User",
    slug: "test-user",
    subscriptionStart: Timestamp.now(),
    lastPayment: Timestamp.now(),
    nextPayment: Timestamp.now(),
  };

  const mockProfile = toUnclaimedProfileResponse(mockProfileDocument);

  const mockListUnclaimedProfiles = mock(() =>
    Promise.resolve({ profiles: [mockProfile], total: 1 }),
  );

  const testApp = createAdminTestPlugin({
    unclaimedProfileAdminService: {
      listUnclaimedProfiles: mockListUnclaimedProfiles,
    },
  });

  beforeEach(() => {
    mockListUnclaimedProfiles.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to list profiles", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
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

  describe("Successful listing", () => {
    it("should return profiles when authenticated as admin", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        profiles?: unknown[];
        total?: number;
      };
      expect(body.profiles).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(mockListUnclaimedProfiles).toHaveBeenCalledTimes(1);
    });
  });

  describe("Query parameter validation", () => {
    it("should reject limit below minimum (1)", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/?limit=0", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject limit above maximum (100)", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/?limit=101", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject negative offset", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/?offset=-1", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid limit and offset", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/?limit=50&offset=10", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });

    it("should use default values when limit and offset not provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        profiles?: unknown[];
        total?: number;
      };
      expect(body.profiles).toBeDefined();
      expect(body.total).toBeDefined();
    });
  });
});
