import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";
import { toUnclaimedProfileResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET / (list unclaimed profiles).
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("GET / (list unclaimed profiles)", () => {
  interface SetupOptions {
    // Request parameters
    authToken?: string | null;
    limit?: string;
    offset?: string;
  }

  function setup({
    authToken = "admin-token",
    limit,
    offset,
  }: SetupOptions = {}) {
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

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const url = new URL("http://localhost/");
    if (limit !== undefined) url.searchParams.set("limit", limit);
    if (offset !== undefined) url.searchParams.set("offset", offset);

    const request = new Request(url.toString(), { headers });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to list profiles", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful listing", () => {
    it("should return profiles when authenticated as admin", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        profiles: unknown[];
        total: number;
      };
      expect(body.profiles).toHaveLength(1);
      expect(body.total).toBe(1);
    });
  });

  describe("Query parameter validation", () => {
    it("should reject limit below minimum (1)", async () => {
      const { testApp, request } = setup({ limit: "0" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject limit above maximum (100)", async () => {
      const { testApp, request } = setup({ limit: "101" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject negative offset", async () => {
      const { testApp, request } = setup({ offset: "-1" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid limit and offset", async () => {
      const { testApp, request } = setup({ limit: "10", offset: "5" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
    });

    it("should use default values when limit and offset not provided", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
    });
  });
});
