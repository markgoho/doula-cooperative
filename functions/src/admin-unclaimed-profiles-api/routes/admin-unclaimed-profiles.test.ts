import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";
import {
  ConflictError,
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  toUnclaimedProfileResponse,
  type ChangeEmailAndResendSuccessResponse,
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

  describe("POST /:email/invitation (send invitation)", () => {
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
      const mockSendInvitation = mock(() => {
        if (profileNotFound) {
          throw new NotFoundError("Unclaimed profile not found");
        }
        return Promise.resolve({ success: true });
      });

      const testApp = createAdminTestPlugin({
        unclaimedProfileAdminService: { sendInvitation: mockSendInvitation },
      });

      // Build request from parameters
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const request = new Request(`http://localhost/${email}/invitation`, {
        method: "POST",
        headers,
      });

      return { testApp, request };
    }

    it("should return 401 when not authenticated", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return 403 when not admin", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });

    it("should send invitation when authenticated as admin", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({
        email: "nonexistent@example.com",
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
      });
    });
  });

  describe("POST /:email/change-email (change email and resend)", () => {
    interface SetupOptions {
      // Request parameters
      oldEmail?: string;
      newEmail?: string;
      authToken?: string | null;

      // Scenario flags
      profileNotFound?: boolean;
      sameEmail?: boolean;
      newEmailAlreadyExists?: boolean;
      moveFailed?: boolean;
      resendFailed?: boolean;
      cleanupWarning?: boolean;
    }

    function setup({
      oldEmail = "test@example.com",
      newEmail = "newemail@example.com",
      authToken = "admin-token",
      profileNotFound = false,
      sameEmail = false,
      newEmailAlreadyExists = false,
      moveFailed = false,
      resendFailed = false,
      cleanupWarning = false,
    }: SetupOptions = {}) {
      const mockChangeEmailAndResend = mock(
        (): Promise<ChangeEmailAndResendSuccessResponse> => {
          if (profileNotFound) {
            return Promise.reject(
              new NotFoundError("Unclaimed profile not found"),
            );
          }
          if (sameEmail) {
            return Promise.reject(
              new HttpError(
                "New email address must be different from the current email.",
                400,
              ),
            );
          }
          if (newEmailAlreadyExists) {
            return Promise.reject(
              new ConflictError(
                "An unclaimed profile with that email already exists.",
              ),
            );
          }
          if (moveFailed) {
            return Promise.reject(
              new HttpError(
                "Failed to move profile to new email address. Please try again.",
                500,
              ),
            );
          }
          if (resendFailed) {
            return Promise.reject(
              new HttpError(
                "Profile email was changed but the invitation failed to send.",
                500,
              ),
            );
          }
          if (cleanupWarning) {
            return Promise.resolve({
              success: true,
              warning:
                "Old member document could not be cleaned up. Manual cleanup may be needed.",
            });
          }
          return Promise.resolve({ success: true });
        },
      );

      const testApp = createAdminTestPlugin({
        unclaimedProfileAdminService: {
          changeEmailAndResend: mockChangeEmailAndResend,
        },
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const request = new Request(`http://localhost/${oldEmail}/change-email`, {
        method: "POST",
        headers,
        body: JSON.stringify({ newEmail }),
      });

      return { testApp, request };
    }

    it("should return 401 when not authenticated", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return 403 when not admin", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });

    it("should change email and resend when authenticated as admin", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body =
        (await response.json()) as ChangeEmailAndResendSuccessResponse;
      expect(body.success).toBe(true);
    });

    it("should return success with warning when cleanup had issues", async () => {
      const { testApp, request } = setup({ cleanupWarning: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body =
        (await response.json()) as ChangeEmailAndResendSuccessResponse;
      expect(body.success).toBe(true);
      expect(body.warning).toContain("cleanup");
    });

    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    it("should return 409 when new email already exists", async () => {
      const { testApp, request } = setup({ newEmailAlreadyExists: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
    });

    describe("Email Parameter Validation", () => {
      it("should reject invalid old email format", async () => {
        const { testApp, request } = setup({ oldEmail: "not-an-email" });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(422);
      });

      it("should reject invalid new email format in body", async () => {
        const { testApp, request } = setup({ newEmail: "not-an-email" });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(422);
      });

      it("should accept valid email formats", async () => {
        const { testApp, request } = setup({
          oldEmail: "valid@example.com",
          newEmail: "new-valid@example.com",
        });

        const response = await handleRequest(testApp, request);

        expect(response.status).toBe(200);
      });
    });
  });
});
