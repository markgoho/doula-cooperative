import { describe, expect, it, mock } from "bun:test";
import {
  ConflictError,
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { ChangeEmailAndResendSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("POST /:email/change-email", () => {
  interface SetupOptions {
    oldEmail?: string;
    newEmail?: string;
    authToken?: string | null;

    profileNotFound?: boolean;
    newEmailAlreadyExists?: boolean;
    sameEmail?: boolean;
    moveFailed?: boolean;
    resendFailed?: boolean;
    cleanupWarning?: boolean;
  }

  function setup({
    oldEmail = "old@example.com",
    newEmail = "new@example.com",
    authToken = "admin-token",
    profileNotFound = false,
    newEmailAlreadyExists = false,
    sameEmail = false,
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
              "Profile email was changed but the invitation failed to send. Please try sending the invitation manually from the new profile page.",
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

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to change email", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Parameter validation", () => {
    it("should reject invalid old email format", async () => {
      const { testApp, request } = setup({ oldEmail: "not-an-email" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject invalid new email format in body", async () => {
      const { testApp, request } = setup({ newEmail: "not-an-email" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should accept valid email formats", async () => {
      const { testApp, request } = setup({
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Successful email change", () => {
    it("should change email and resend invitation", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it("should return success with warning when cleanup had issues", async () => {
      const { testApp, request } = setup({ cleanupWarning: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.warning).toContain("cleanup");
    });
  });

  describe("Error handling", () => {
    it("should return 404 when old profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 400 when old and new email are the same", async () => {
      const { testApp, request } = setup({ sameEmail: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("different");
    });

    it("should return 409 when new email already exists as unclaimed profile", async () => {
      const { testApp, request } = setup({ newEmailAlreadyExists: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already exists");
    });

    it("should return 500 when profile move fails", async () => {
      const { testApp, request } = setup({ moveFailed: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to move profile");
    });

    it("should return 500 when invitation resend fails after move", async () => {
      const { testApp, request } = setup({ resendFailed: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("invitation failed to send");
    });
  });
});
