import { describe, expect, it, mock } from "bun:test";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { ToggleProfileDraftResult } from "../services/toggle-profile-draft.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/profile/toggle-draft.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/profile/toggle-draft", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    memberNotFound?: boolean;
    noSlug?: boolean;
    profileNotFound?: boolean;
    serverError?: boolean;
    toggleResult?: ToggleProfileDraftResult;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    noSlug = false,
    profileNotFound = false,
    serverError = false,
    toggleResult,
  }: SetupOptions = {}) {
    const defaultResult: ToggleProfileDraftResult = {
      slug: "test-slug",
      draft: false,
      hugoRebuildTriggered: true,
    };

    const mockToggleProfileDraft = mock(
      (): Promise<ToggleProfileDraftResult> => {
        if (memberNotFound) {
          return Promise.reject(
            new NotFoundError(`Member with ID ${memberId} not found`),
          );
        }
        if (noSlug) {
          return Promise.reject(
            new ValidationError(
              "Member does not have a profile slug. Cannot toggle draft status.",
            ),
          );
        }
        if (profileNotFound) {
          return Promise.reject(
            new NotFoundError("Profile not found for slug: test-slug"),
          );
        }
        if (serverError) {
          return Promise.reject(new Error("Firestore unavailable"));
        }
        return Promise.resolve(toggleResult ?? defaultResult);
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        toggleProfileDraft: mockToggleProfileDraft,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/profile/toggle-draft`,
      {
        method: "POST",
        headers,
      },
    );

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

    it("should return 403 when non-admin user tries to toggle draft", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful toggle", () => {
    it("should toggle draft to published and return success", async () => {
      const { testApp, request } = setup({
        toggleResult: {
          slug: "jane-doe",
          draft: false,
          hugoRebuildTriggered: true,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        slug?: string;
        draft?: boolean;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("jane-doe");
      expect(body.draft).toBe(false);
      expect(body.warning).toBeUndefined();
    });

    it("should toggle draft to unpublished and return success", async () => {
      const { testApp, request } = setup({
        toggleResult: {
          slug: "jane-doe",
          draft: true,
          hugoRebuildTriggered: true,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        slug?: string;
        draft?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("jane-doe");
      expect(body.draft).toBe(true);
    });

    it("should include warning when Hugo rebuild fails", async () => {
      const { testApp, request } = setup({
        toggleResult: {
          slug: "jane-doe",
          draft: false,
          hugoRebuildTriggered: false,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.warning).toContain("Hugo rebuild failed");
    });
  });

  describe("Error handling", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 400 when member has no slug", async () => {
      const { testApp, request } = setup({ noSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("profile slug");
    });

    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Profile not found");
    });

    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain("Firestore unavailable");
    });
  });
});
