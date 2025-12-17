import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { SendInvitationSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:email/invitation.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /:email/invitation", () => {
  const mockSendInvitation = mock(
    ({ email }: { email: string }): Promise<SendInvitationSuccessResponse> => {
      if (email === "nonexistent@example.com") {
        return Promise.reject(new NotFoundError("Unclaimed profile not found"));
      }
      if (email === "invalid-data@example.com") {
        return Promise.reject(
          new HttpError(
            "Unclaimed profile is missing required data (subscriptionStart).",
            412,
          ),
        );
      }
      if (email === "email-failed@example.com") {
        return Promise.reject(
          new HttpError("Failed to send invitation email.", 500),
        );
      }
      if (email === "tracking-failed@example.com") {
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

  beforeEach(() => {
    mockSendInvitation.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com/invitation", {
          method: "POST",
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to send invitation", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com/invitation", {
          method: "POST",
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
        new Request("http://localhost/not-an-email/invitation", {
          method: "POST",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid email format", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/valid@example.com/invitation", {
          method: "POST",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Successful invitation", () => {
    it("should send invitation when authenticated as admin", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test@example.com/invitation", {
          method: "POST",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
      expect(mockSendInvitation).toHaveBeenCalledTimes(1);
    });

    it("should return success with warning when email sent but tracking failed", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/tracking-failed@example.com/invitation", {
          method: "POST",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
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
        new Request("http://localhost/nonexistent@example.com/invitation", {
          method: "POST",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });

    it("should return 412 when profile missing required data", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/invalid-data@example.com/invitation", {
          method: "POST",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(412);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("missing required data");
    });

    it("should return 500 when email sending fails", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/email-failed@example.com/invitation", {
          method: "POST",
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to send invitation email");
    });
  });
});
