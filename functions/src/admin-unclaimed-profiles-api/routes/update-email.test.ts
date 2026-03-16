import {
  ConflictError,
  HttpError,
  NotFoundError,
} from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { handleRequest } from "@doula-coop/functions-shared/test-utils/handle-request.js";
import { describe, expect, it, mock } from "bun:test";
import type { UpdateEmailSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("PATCH /:email", () => {
  interface SetupOptions {
    oldEmail?: string;
    newEmail?: string;
    authToken?: string | null;

    profileNotFound?: boolean;
    newEmailAlreadyExists?: boolean;
    sameEmail?: boolean;
    moveFailed?: boolean;
  }

  function setup({
    oldEmail = "old@example.com",
    newEmail = "new@example.com",
    authToken = "admin-token",
    profileNotFound = false,
    newEmailAlreadyExists = false,
    sameEmail = false,
    moveFailed = false,
  }: SetupOptions = {}) {
    const mockUpdateEmail = mock((): Promise<UpdateEmailSuccessResponse> => {
      if (profileNotFound) {
        return Promise.reject(new NotFoundError("Unclaimed profile not found"));
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
            "Failed to update profile email address. Please try again.",
            500,
          ),
        );
      }
      return Promise.resolve({ success: true as const });
    });

    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: {
        updateEmail: mockUpdateEmail,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${oldEmail}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ newEmail }),
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin tries to update email", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Parameter validation", () => {
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
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Successful email update", () => {
    it("should update email for unclaimed profile", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should return 404 when old profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 400 when old and new email are the same", async () => {
      const { testApp, request } = setup({ sameEmail: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("different");
    });

    it("should return 409 when new email already exists as unclaimed profile", async () => {
      const { testApp, request } = setup({ newEmailAlreadyExists: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already exists");
    });

    it("should return 500 when profile move fails", async () => {
      const { testApp, request } = setup({ moveFailed: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to update profile");
    });
  });
});
