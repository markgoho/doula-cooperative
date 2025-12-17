import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { SendInvitationSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

function createTestRequest(email: string, authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  return new Request(`http://localhost/${email}/invitation`, {
    method: "POST",
    headers,
  });
}

/**
 * Tests for POST /:email/invitation.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /:email/invitation", () => {
  // Define mock responses as a lookup map for clarity
  const mockResponses: Record<
    string,
    () => Promise<SendInvitationSuccessResponse>
  > = {
    "nonexistent@example.com": () =>
      Promise.reject(new NotFoundError("Unclaimed profile not found")),
    "invalid-data@example.com": () =>
      Promise.reject(
        new HttpError(
          "Unclaimed profile is missing required data (subscriptionStart).",
          412,
        ),
      ),
    "auth-failed@example.com": () =>
      Promise.reject(new HttpError("Failed to create user account.", 500)),
    "member-doc-fail@example.com": () =>
      Promise.reject(
        new HttpError("Failed to create member record. Please try again.", 500),
      ),
    "email-failed@example.com": () =>
      Promise.reject(
        new HttpError(
          "User account created but invitation email failed to send. Please retry or contact the user directly.",
          500,
        ),
      ),
    "tracking-failed@example.com": () =>
      Promise.resolve({
        success: true,
        warning:
          "Invitation sent but tracking update failed. The email was delivered successfully.",
      }),
  };

  const mockSendInvitation = mock(
    ({ email }: { email: string }): Promise<SendInvitationSuccessResponse> => {
      const mockResponse = mockResponses[email];
      return mockResponse ? mockResponse() : Promise.resolve({ success: true });
    },
  );

  const testApp = createAdminTestPlugin({
    unclaimedProfileAdminService: {
      sendInvitation: mockSendInvitation,
    },
  });

  beforeEach(() => {
    mockSendInvitation.mockClear();
  });

  // Helper function to create test requests

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        createTestRequest("test@example.com"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to send invitation", async () => {
      const response = (await testApp.handle(
        createTestRequest("test@example.com", "Bearer non-admin-token"),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Email parameter validation", () => {
    it("should reject invalid email format", async () => {
      const response = (await testApp.handle(
        createTestRequest("not-an-email", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid email format", async () => {
      const response = (await testApp.handle(
        createTestRequest("valid@example.com", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Successful invitation", () => {
    it("should send invitation when authenticated as admin", async () => {
      const response = (await testApp.handle(
        createTestRequest("test@example.com", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
      expect(mockSendInvitation).toHaveBeenCalledTimes(1);
    });

    it("should return success with warning when email sent but tracking failed", async () => {
      const response = (await testApp.handle(
        createTestRequest("tracking-failed@example.com", "Bearer admin-token"),
      )) as Response;

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
      const response = (await testApp.handle(
        createTestRequest("nonexistent@example.com", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });

    it("should return 412 when profile missing required data", async () => {
      const response = (await testApp.handle(
        createTestRequest("invalid-data@example.com", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(412);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("missing required data");
    });

    it("should return 500 when auth user creation fails", async () => {
      const response = (await testApp.handle(
        createTestRequest("auth-failed@example.com", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to create user account");
    });

    it("should return 500 when member document creation fails", async () => {
      const response = (await testApp.handle(
        createTestRequest("member-doc-fail@example.com", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to create member record");
      expect(body.error).toContain("try again"); // Actionable error message
    });

    it("should return 500 when invitation email fails to send", async () => {
      const response = (await testApp.handle(
        createTestRequest("email-failed@example.com", "Bearer admin-token"),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("invitation email failed to send");
      expect(body.error).toContain("retry"); // Actionable guidance
    });
  });
});
