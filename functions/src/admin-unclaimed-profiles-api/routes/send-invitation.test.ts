import { describe, expect, it, mock } from "bun:test";
import {
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { SendInvitationSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:email/invitation.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /:email/invitation", () => {
  interface SetupOptions {
    // Request parameters
    email?: string;
    authToken?: string | null;

    // Scenario flags
    profileNotFound?: boolean;
    missingRequiredData?: boolean;
    authFailed?: boolean;
    memberDocumentFailed?: boolean;
    emailFailed?: boolean;
    trackingFailed?: boolean;
  }

  function setup({
    email = "test@example.com",
    authToken = "admin-token",
    profileNotFound = false,
    missingRequiredData = false,
    authFailed = false,
    memberDocumentFailed = false,
    emailFailed = false,
    trackingFailed = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario flags
    const mockSendInvitation = mock(
      (): Promise<SendInvitationSuccessResponse> => {
        if (profileNotFound) {
          return Promise.reject(
            new NotFoundError("Unclaimed profile not found"),
          );
        }
        if (missingRequiredData) {
          return Promise.reject(
            new HttpError(
              "Unclaimed profile is missing required data (subscriptionStart).",
              412,
            ),
          );
        }
        if (authFailed) {
          return Promise.reject(
            new HttpError("Failed to create user account.", 500),
          );
        }
        if (memberDocumentFailed) {
          return Promise.reject(
            new HttpError(
              "Failed to create member record. Please try again.",
              500,
            ),
          );
        }
        if (emailFailed) {
          return Promise.reject(
            new HttpError(
              "User account created but invitation email failed to send. Please retry or contact the user directly.",
              500,
            ),
          );
        }
        if (trackingFailed) {
          return Promise.resolve({
            success: true,
            warning:
              "Invitation sent but tracking update failed. The email was delivered successfully.",
          });
        }
        return Promise.resolve({ success: true });
      },
    );

    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: {
        sendInvitation: mockSendInvitation,
      },
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

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to send invitation", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Email parameter validation", () => {
    it("should reject invalid email format", async () => {
      const { testApp, request } = setup({ email: "not-an-email" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid email format", async () => {
      const { testApp, request } = setup({ email: "valid@example.com" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Successful invitation", () => {
    it("should send invitation when authenticated as admin", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it("should return success with warning when email sent but tracking failed", async () => {
      const { testApp, request } = setup({ trackingFailed: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.warning).toBeTruthy();
      expect(body.warning).toContain("tracking update failed");
      expect(body.warning).toContain("email was delivered successfully");
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });

    it("should return 412 when profile missing required data", async () => {
      const { testApp, request } = setup({ missingRequiredData: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(412);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("missing required data");
    });

    it("should return 500 when auth user creation fails", async () => {
      const { testApp, request } = setup({ authFailed: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to create user account");
    });

    it("should return 500 when member document creation fails", async () => {
      const { testApp, request } = setup({ memberDocumentFailed: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to create member record");
      expect(body.error).toContain("try again");
    });

    it("should return 500 when invitation email fails to send", async () => {
      const { testApp, request } = setup({ emailFailed: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("invitation email failed to send");
      expect(body.error).toContain("retry");
    });
  });
});
