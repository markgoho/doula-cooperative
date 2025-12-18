import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

/**
 * Tests for the newsletter preference update endpoint.
 *
 * Uses createMembersTestPlugin() factory with mocked services.
 * Tests only the members plugin in isolation - no full app composition needed.
 */
describe("PATCH /:memberId/newsletter-preference (authenticated)", () => {
  interface SetupOptions {
    // Request parameters
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;

    // Environment
    mailerliteApiKey?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    missingSubscriptionDates?: boolean;
    serverError?: boolean;
  }

  function setup({
    body = { subscribed: true },
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    mailerliteApiKey = "test-api-key",
    memberNotFound = false,
    missingSubscriptionDates = false,
    serverError = false,
  }: SetupOptions = {}) {
    // Set environment variable for this test
    if (mailerliteApiKey === null) {
      delete process.env["MAILERLITE_API_KEY"];
    } else {
      process.env["MAILERLITE_API_KEY"] = mailerliteApiKey;
    }

    // Configure mocks based on scenario
    const mockUpdateNewsletterPreference = mock(
      ({
        memberId: id,
        subscribed,
      }: {
        memberId: string;
        subscribed: boolean;
        mailerliteApiKey: string;
        emailService: unknown;
        logger: unknown;
      }): Promise<{ subscribed: boolean }> => {
        if (serverError) {
          throw new Error("MailerLite API connection timeout");
        }
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(
            new NotFoundError(
              "Member document not found. Please contact support.",
            ),
          );
        }
        if (missingSubscriptionDates || id === "no-subscription-dates") {
          return Promise.reject(
            new ValidationError(
              "Your account is missing required membership information. Please contact support.",
            ),
          );
        }
        return Promise.resolve({ subscribed });
      },
    );

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
            new ForbiddenError(
              "You can only update your own newsletter preference",
            ),
          );
        }

        return Promise.reject(new AuthError("Invalid authentication token"));
      },
    );

    const testApp = createMembersTestPlugin({
      newsletterService: {
        updateNewsletterPreference: mockUpdateNewsletterPreference,
      },
      authService: {
        verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/newsletter-preference`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      },
    );

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

    it("should return 403 when non-owner tries to update newsletter preference", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "You can only update your own newsletter preference",
      );
    });

    it("should allow owner to update their own newsletter preference", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        subscribed: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscribed).toBe(true);
    });

    it("should allow admin to update any member newsletter preference", async () => {
      const { testApp, request } = setup({
        authToken: "admin-token",
        body: { subscribed: false },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        subscribed: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscribed).toBe(false);
    });
  });

  describe("Newsletter subscription", () => {
    it("should successfully subscribe to newsletter", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        subscribed: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscribed).toBe(true);
    });

    it("should successfully unsubscribe from newsletter", async () => {
      const { testApp, request } = setup({ body: { subscribed: false } });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        subscribed: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscribed).toBe(false);
    });

    it("should return 404 when member does not exist", async () => {
      const { testApp, request } = setup({
        memberId: "non-existent-id",
        authToken: "admin-token",
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Member document not found. Please contact support.",
      );
    });

    it("should return 400 when member is missing subscription dates", async () => {
      const { testApp, request } = setup({
        memberId: "no-subscription-dates",
        authToken: "admin-token",
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Your account is missing required membership information. Please contact support.",
      );
    });
  });

  describe("Input validation", () => {
    it("should reject request without subscribed field", async () => {
      const { testApp, request } = setup({ body: {} });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject request with non-boolean subscribed value", async () => {
      const { testApp, request } = setup({ body: { subscribed: "true" } });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject empty member ID", async () => {
      const { testApp } = setup();

      const request = new Request("http://localhost//newsletter-preference", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-owner-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscribed: true }),
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
    });

    it("should reject member IDs longer than 128 characters", async () => {
      const { testApp } = setup();

      const longId = "a".repeat(129);
      const request = new Request(
        `http://localhost/${longId}/newsletter-preference`,
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        },
      );

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Response format", () => {
    it("should return JSON content type", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });

    it("should return success field in response", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to update newsletter preference");
    });

    it("should return 503 when MAILERLITE_API_KEY is not configured", async () => {
      const { testApp, request } = setup({ mailerliteApiKey: null });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(503);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Newsletter service not configured. Please contact support.",
      );
    });
  });

});

