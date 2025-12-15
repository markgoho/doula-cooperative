import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import {
  toUnclaimedProfileResponse,
  type UnclaimedProfileResponse,
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
    const mockListProfiles = mock(() =>
      Promise.resolve({ profiles: [mockProfile], total: 1 }),
    );
    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: { listUnclaimedProfiles: mockListProfiles },
    });

    beforeEach(() => mockListProfiles.mockClear());

    it("should return 401 when not authenticated", async () => {
      const response = (await testApp.handle(new Request("http://localhost/"))) as Response;
      expect(response.status).toBe(401);
    });

    it("should return profiles when authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { profiles: unknown[]; total: number };
      expect(body.profiles).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    describe("Query Parameter Validation", () => {
      it("should reject limit below minimum (1)", async () => {
        const response = (await testApp.handle(
          new Request("http://localhost/?limit=0", {
            headers: { Authorization: "Bearer admin-token" },
          }),
        )) as Response;

        expect(response.status).toBe(422);
      });

      it("should reject limit above maximum (100)", async () => {
        const response = (await testApp.handle(
          new Request("http://localhost/?limit=101", {
            headers: { Authorization: "Bearer admin-token" },
          }),
        )) as Response;

        expect(response.status).toBe(422);
      });

      it("should reject negative offset", async () => {
        const response = (await testApp.handle(
          new Request("http://localhost/?offset=-1", {
            headers: { Authorization: "Bearer admin-token" },
          }),
        )) as Response;

        expect(response.status).toBe(422);
      });

      it("should accept valid limit and offset", async () => {
        const response = (await testApp.handle(
          new Request("http://localhost/?limit=50&offset=10", {
            headers: { Authorization: "Bearer admin-token" },
          }),
        )) as Response;

        expect(response.status).toBe(200);
      });
    });
  });

  describe("GET /:email (get)", () => {
    const mockGetProfile = mock(() => Promise.resolve(mockProfile));
    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: { getUnclaimedProfile: mockGetProfile },
    });

    beforeEach(() => mockGetProfile.mockClear());

    it("should return 401 when not authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com"),
      )) as Response;
      expect(response.status).toBe(401);
    });

    it("should return profile when authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as UnclaimedProfileResponse;
      expect(body.email).toBe("test@example.com");
    });

    it("should return 404 when not found", async () => {
      const notFoundApp = createAdminTestPlugin({
        unclaimedProfileAdminService: {
          getUnclaimedProfile: mock(() => { throw new NotFoundError("Not found"); }),
        },
      });

      const response = (await notFoundApp.handle(
        new Request("http://localhost/none@example.com", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(404);
    });

    describe("Email Parameter Validation", () => {
      it("should reject invalid email format", async () => {
        const response = (await testApp.handle(
          new Request("http://localhost/not-an-email", {
            headers: { Authorization: "Bearer admin-token" },
          }),
        )) as Response;

        expect(response.status).toBe(422);
      });

      it("should accept valid email format", async () => {
        const response = (await testApp.handle(
          new Request("http://localhost/valid@example.com", {
            headers: { Authorization: "Bearer admin-token" },
          }),
        )) as Response;

        expect(response.status).toBe(200);
        const body = (await response.json()) as UnclaimedProfileResponse;
        expect(body.email).toBe("test@example.com");
      });
    });
  });
});
