import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
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
    emailAlreadyVerified?: boolean;
    /** When true, overrides auth mock with explicit email_verified: false */
    emailVerifiedExplicit?: boolean;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    serverError = false,
    emailAlreadyVerified = false,
    emailVerifiedExplicit = false,
  }: SetupOptions = {}) {
    const mockMarkEmailVerified = mock((): Promise<void> => {
      if (serverError) {
        throw new Error("Firebase Admin error");
      }
      return Promise.resolve();
    });

    // Override auth service when we need explicit email_verified state
    const needsAuthOverride = emailAlreadyVerified || emailVerifiedExplicit;

    const testApp = createMembersTestPlugin({
      verifyEmailService: {
        markEmailVerified: mockMarkEmailVerified,
      },
      ...(needsAuthOverride && {
        authService: {
          verifyOwnerOrAdmin: mock(() =>
            Promise.resolve({
              uid: memberId,
              email: "test@example.com",
              email_verified: emailAlreadyVerified,
            } as DecodedIdToken),
          ),
        },
      }),
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

    it("should return 401 for invalid authentication token", async () => {
      const { testApp, request } = setup({ authToken: "invalid-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
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
      const { testApp, request } = setup({ emailVerifiedExplicit: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("should return success when email is already verified (idempotent)", async () => {
      const { testApp, request } = setup({ emailAlreadyVerified: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Input validation", () => {
    it("should reject empty member ID", async () => {
      const { testApp } = setup();

      const request = new Request("http://localhost//verify-email", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-owner-token",
          "Content-Type": "application/json",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    it("should reject member IDs longer than 128 characters", async () => {
      const { testApp } = setup();

      const longId = "a".repeat(129);
      const request = new Request(`http://localhost/${longId}/verify-email`, {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
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
