import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  toUnclaimedProfileResponse,
  type UnclaimedProfileSuccessResponse,
} from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("Admin Unclaimed Profiles API", () => {
  const mockProfileDocument: UnclaimedProfileDocument = {
    email: "test@example.com",
    name: "Test User",
    slug: "test-user",
    subscriptionStart: Timestamp.now(),
    lastPayment: Timestamp.now(),
    nextPayment: Timestamp.now(),
  };

  const mockProfile = toUnclaimedProfileResponse(mockProfileDocument);

  describe("GET / (list)", () => {
    interface SetupOptions {
      // Request parameters
      limit?: number;
      offset?: number;
      authToken?: string | null;
    }

    function setup({
      limit,
      offset,
      authToken = "admin-token",
    }: SetupOptions = {}) {
      const mockListProfiles = mock(() =>
        Promise.resolve({ profiles: [mockProfile], total: 1 }),
      );

      const testApp = createAdminTestPlugin({
        unclaimedProfileAdminService: {
          listUnclaimedProfiles: mockListProfiles,
        },
      });

      // Build request from parameters
      const queryParameters = new URLSearchParams();
      if (limit !== undefined) {
        queryParameters.set("limit", String(limit));
      }
      if (offset !== undefined) {
        queryParameters.set("offset", String(offset));
      }

      const url = `http://localhost/${queryParameters.toString() ? `?${queryParameters.toString()}` : ""}`;
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const request = new Request(url, { headers });

      return { testApp, request };
    }

    it("should return 401 when not authenticated", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return profiles when authenticated", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        profiles: unknown[];
        total: number;
      };
      expect(body.profiles).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    describe("Query Parameter Validation", () => {
      it("should reject limit below minimum (1)", async () => {
        const { testApp, request } = setup({ limit: 0 });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(422);
      });

      it("should reject limit above maximum (100)", async () => {
        const { testApp, request } = setup({ limit: 101 });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(422);
      });

      it("should reject negative offset", async () => {
        const { testApp, request } = setup({ offset: -1 });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(422);
      });

      it("should accept valid limit and offset", async () => {
        const { testApp, request } = setup({ limit: 50, offset: 10 });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(200);
      });
    });
  });

  describe("GET /:email (get)", () => {
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
      const mockGetProfile = mock(() => {
        if (profileNotFound) {
          throw new NotFoundError("Not found");
        }
        return Promise.resolve(mockProfile);
      });

      const testApp = createAdminTestPlugin({
        unclaimedProfileAdminService: { getUnclaimedProfile: mockGetProfile },
      });

      // Build request from parameters
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const request = new Request(`http://localhost/${email}`, { headers });

      return { testApp, request };
    }

    it("should return 401 when not authenticated", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return profile when authenticated", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as UnclaimedProfileSuccessResponse;
      expect(body.email).toBe("test@example.com");
    });

    it("should return 404 when not found", async () => {
      const { testApp, request } = setup({
        email: "none@example.com",
        profileNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    describe("Email Parameter Validation", () => {
      it("should reject invalid email format", async () => {
        const { testApp, request } = setup({ email: "not-an-email" });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(422);
      });

      it("should accept valid email format", async () => {
        const { testApp, request } = setup({ email: "valid@example.com" });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(200);
        const body = (await response.json()) as UnclaimedProfileSuccessResponse;
        expect(body.email).toBe("test@example.com");
      });
    });
  });

});
