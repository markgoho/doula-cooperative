import { describe, expect, it, beforeEach, mock } from "bun:test";
import {
  NotFoundError,
  AuthError,
  ForbiddenError,
  ValidationError,
  HttpError,
} from "../../shared-api/errors/http-error.js";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

/**
 * Tests for the newsletter preference update endpoint.
 *
 * Uses createMembersTestPlugin() factory with mocked services.
 * Tests only the members plugin in isolation - no full app composition needed.
 * Tests run WITHOUT Firebase emulators.
 */
describe("PATCH /:memberId/newsletter-preference (authenticated)", () => {
  // Create mock services
  const mockUpdateNewsletterPreference = mock(
    ({
      memberId,
      subscribed,
    }: {
      memberId: string;
      subscribed: boolean;
      mailerliteApiKey: string;
      mailgunApiKey: string | undefined;
      logger: unknown;
    }): Promise<{ subscribed: boolean }> => {
      if (memberId === "test-member-id") {
        return Promise.resolve({ subscribed });
      }
      if (memberId === "no-subscription-dates") {
        return Promise.reject(
          new ValidationError(
            "Your account is missing required membership information. Please contact support.",
          ),
        );
      }
      return Promise.reject(
        new NotFoundError("Member document not found. Please contact support."),
      );
    },
  );

  const mockVerifyOwnerOrAdmin = mock(
    (
      authorizationHeader: string | undefined,
      memberId: string,
    ): Promise<DecodedIdToken> => {
      if (!authorizationHeader) {
        return Promise.reject(new AuthError("Missing Authorization header"));
      }

      if (
        authorizationHeader === "Bearer valid-owner-token" &&
        memberId === "test-member-id"
      ) {
        return Promise.resolve({
          uid: "test-member-id",
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
          new ForbiddenError("You can only update your own newsletter preference"),
        );
      }

      return Promise.reject(new AuthError("Invalid authentication token"));
    },
  );

  // Create plugin with mocked services - tests only the members plugin in isolation
  const testApp = createMembersTestPlugin({
    newsletterService: {
      updateNewsletterPreference: mockUpdateNewsletterPreference,
    },
    authService: {
      verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
    },
  });

  beforeEach(() => {
    mockUpdateNewsletterPreference.mockClear();
    mockVerifyOwnerOrAdmin.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-owner tries to update newsletter preference", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer non-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You can only update your own newsletter preference");
    });

    it("should allow owner to update their own newsletter preference", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        subscribed: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscribed).toBe(true);
    });

    it("should allow admin to update any member newsletter preference", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: false }),
        }),
      )) as Response;

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
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        subscribed: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscribed).toBe(true);
    });

    it("should successfully unsubscribe from newsletter", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: false }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        subscribed: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscribed).toBe(false);
    });

    it("should return 404 when member does not exist", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/non-existent-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Member document not found. Please contact support.",
      );
    });

    it("should return 400 when member is missing subscription dates", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/no-subscription-dates/newsletter-preference",
          {
            method: "PATCH",
            headers: {
              Authorization: "Bearer admin-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ subscribed: true }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Your account is missing required membership information. Please contact support.",
      );
    });
  });

  describe("Input validation", () => {
    it("should reject request without subscribed field", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject request with non-boolean subscribed value", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: "true" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject empty member ID", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost//newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      expect(response.status).toBe(404);
    });

    it("should reject member IDs longer than 128 characters", async () => {
      const longId = "a".repeat(129);
      const response = (await testApp.handle(
        new Request(
          `http://localhost/${longId}/newsletter-preference`,
          {
            method: "PATCH",
            headers: {
              Authorization: "Bearer admin-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ subscribed: true }),
          },
        ),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should not call service for invalid member IDs", async () => {
      const longId = "a".repeat(129);
      mockUpdateNewsletterPreference.mockClear();

      await testApp.handle(
        new Request(`http://localhost/${longId}/newsletter-preference`, {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      );

      // Service should not be called when validation fails before route handler executes
      expect(mockUpdateNewsletterPreference).not.toHaveBeenCalled();
    });
  });

  describe("Response format", () => {
    it("should return JSON content type", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });

    it("should return success field in response", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle unexpected errors with logging", async () => {
      // Create mock that throws unexpected error (not HttpError)
      const errorMock = mock();
      const mockUpdateWithError = mock(() => {
        throw new Error("MailerLite API connection timeout");
      });

      const testAppWithError = createMembersTestPlugin({
        newsletterService: {
          updateNewsletterPreference: mockUpdateWithError,
        },
        authService: {
          verifyOwnerOrAdmin: mock(() =>
            Promise.resolve({
              uid: "test-id",
              admin: false,
            } as unknown as DecodedIdToken),
          ),
        },
        logger: {
          error: errorMock,
          warn: mock(),
          info: mock(),
        },
      });

      const response = (await testAppWithError.handle(
        new Request("http://localhost/test-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      // Should return 500 for unexpected errors
      expect(response.status).toBe(500);

      // Should return descriptive error message
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to update newsletter preference");

      // Should have logged the error with context
      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(Array.isArray(errorMock.mock.calls[0])).toBe(true);
      expect(errorMock.mock.calls[0]?.[0]).toBe(
        "Failed to update newsletter preference",
      );

      // Verify error context includes authentication info
      const context = errorMock.mock.calls[0]?.[1] as
        | Record<string, unknown>
        | undefined;
      expect(context).toBeDefined();
      expect(context?.["errorMessage"]).toBe("MailerLite API connection timeout");
      expect(context?.["memberId"]).toBe("test-id");
      expect(context?.["subscribed"]).toBe(true);
      expect(context?.["hasAuthorizationHeader"]).toBe(true);
    });

    it("should handle HttpError correctly without logging as unexpected", async () => {
      const errorMock = mock();

      // HttpError should be handled normally without triggering unexpected error logging
      const testAppWithLogger = createMembersTestPlugin({
        newsletterService: {
          updateNewsletterPreference: mockUpdateNewsletterPreference,
        },
        authService: {
          verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
        },
        logger: {
          error: errorMock,
          warn: mock(),
          info: mock(),
        },
      });

      const response = (await testAppWithLogger.handle(
        new Request("http://localhost/non-existent-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      // Should return 404 for NotFoundError (which extends HttpError)
      expect(response.status).toBe(404);

      // Should NOT have logged as unexpected error
      expect(errorMock).not.toHaveBeenCalled();
    });

    it("should return 503 when MAILERLITE_API_KEY is not configured", async () => {
      const originalEnv = process.env["MAILERLITE_API_KEY"];
      delete process.env["MAILERLITE_API_KEY"];

      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscribed: true }),
        }),
      )) as Response;

      expect(response.status).toBe(503);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Newsletter service not configured. Please contact support.",
      );

      // Restore environment variable
      if (originalEnv !== undefined) {
        process.env["MAILERLITE_API_KEY"] = originalEnv;
      }
    });
  });

  describe("Edge cases", () => {
    it("should reject member IDs with URL-encoded forward slashes", async () => {
      const response = (await testApp.handle(
        new Request(
          "http://localhost/user%2Fwith%2Fslash/newsletter-preference",
          {
            method: "PATCH",
            headers: {
              Authorization: "Bearer admin-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ subscribed: true }),
          },
        ),
      )) as Response;

      // Forward slashes are not valid in Firestore document IDs
      expect(response.status).toBe(404);
    });

    it("should handle invalid JSON in request body", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-member-id/newsletter-preference", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer valid-owner-token",
            "Content-Type": "application/json",
          },
          body: "invalid json{",
        }),
      )) as Response;

      // Elysia should return 400 for invalid JSON
      expect([400, 422]).toContain(response.status);
    });
  });
});
