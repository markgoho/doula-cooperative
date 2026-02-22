import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import {
  AuthError,
  ForbiddenError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

/**
 * Tests for the verify email endpoint.
 *
 * Uses createMembersTestPlugin() factory with mocked services.
 * Tests only the members plugin in isolation.
 */
describe("POST /:memberId/verify-email (authenticated)", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    serverError?: boolean;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    serverError = false,
  }: SetupOptions = {}) {
    const mockMarkEmailVerified = mock((_uid: string): Promise<void> => {
      if (serverError) {
        throw new Error("Firebase Admin error");
      }
      return Promise.resolve();
    });

    const mockVerifyOwnerOrAdmin = mock(
      (
        authorizationHeader: string | undefined,
        targetMemberId: string,
      ): Promise<DecodedIdToken> => {
        if (!authorizationHeader) {
          return Promise.reject(new AuthError("Missing Authorization header"));
        }

        if (
          authorizationHeader === "Bearer valid-owner-token" &&
          (targetMemberId === "test-member-id" || targetMemberId === "test-id")
        ) {
          return Promise.resolve({
            uid: targetMemberId,
            email: "test@example.com",
          } as DecodedIdToken);
        }

        if (authorizationHeader === "Bearer admin-token") {
          return Promise.resolve({
            uid: "admin-user",
            email: "admin@example.com",
            admin: true,
          } as unknown as DecodedIdToken);
        }

        if (authorizationHeader === "Bearer non-owner-token") {
          return Promise.reject(
            new ForbiddenError("You can only verify your own email"),
          );
        }

        return Promise.reject(new AuthError("Invalid authentication token"));
      },
    );

    const testApp = createMembersTestPlugin({
      verifyEmailService: {
        markEmailVerified: mockMarkEmailVerified,
      },
      authService: {
        verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/verify-email`, {
      method: "POST",
      headers,
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

    it("should return 403 when non-owner tries to verify email", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });

    it("should return 403 when admin tries to verify another member's email", async () => {
      const { testApp, request } = setup({ authToken: "admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You can only verify your own email");
    });
  });

  describe("Email verification", () => {
    it("should successfully verify email for owner", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to verify email");
    });
  });
});
