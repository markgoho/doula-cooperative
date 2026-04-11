import { describe, expect, it, mock } from "bun:test";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("POST /:email/draft", () => {
  interface SetupOptions {
    email?: string;
    authToken?: string | null;
    profileNotFound?: boolean;
    missingSlug?: boolean;
    rebuildTriggered?: boolean;
    serviceError?: boolean;
  }

  function setup({
    email = "test@example.com",
    authToken = "admin-token",
    profileNotFound = false,
    missingSlug = false,
    rebuildTriggered = true,
    serviceError = false,
  }: SetupOptions = {}) {
    const mockDraftUnclaimedProfile = mock(
      ({
        email: requestEmail,
      }: {
        email: string;
      }): Promise<{
        success: true;
        slug: string;
        warning?: string;
      }> => {
        if (serviceError) {
          return Promise.reject(new Error("Unexpected database error"));
        }

        if (profileNotFound || requestEmail === "nonexistent@example.com") {
          return Promise.reject(
            new NotFoundError("Unclaimed profile not found"),
          );
        }

        if (missingSlug) {
          return Promise.reject(
            new ValidationError(
              `Unclaimed profile with email ${requestEmail} does not have a profile slug`,
            ),
          );
        }

        return Promise.resolve({
          success: true,
          slug: "test-slug",
          ...(!rebuildTriggered && {
            warning:
              "Profile was set to draft, but the site rebuild did not trigger. The change may not appear immediately.",
          }),
        });
      },
    );

    const testApp = createAdminTestPlugin({
      unclaimedProfileAdminService: {
        draftUnclaimedProfile: mockDraftUnclaimedProfile,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${email}/draft`, {
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

    it("should return 403 when non-admin user tries to draft", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Email parameter validation", () => {
    it("should reject invalid email format", async () => {
      const { testApp, request } = setup({ email: "not-an-email" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Successful drafting", () => {
    it("should draft unclaimed profile when authenticated as admin", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        slug?: string;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("test-slug");
      expect(body.warning).toBeUndefined();
    });

    it("should return warning when rebuild trigger fails", async () => {
      const { testApp, request } = setup({ rebuildTriggered: false });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        slug?: string;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("test-slug");
      expect(body.warning).toBe(
        "Profile was set to draft, but the site rebuild did not trigger. The change may not appear immediately.",
      );
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Unclaimed profile not found");
    });

    it("should return 400 when profile has no slug", async () => {
      const { testApp, request } = setup({ missingSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Unclaimed profile with email test@example.com does not have a profile slug",
      );
    });

    it("should return 500 on unexpected service error", async () => {
      const { testApp, request } = setup({ serviceError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeTruthy();
    });
  });
});
