import { describe, expect, it, mock } from "bun:test";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { DeleteDraftProfileResult } from "../services/delete-draft-profile.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("POST /:memberId/profile/delete-draft", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    memberNotFound?: boolean;
    noSlug?: boolean;
    profileNotDraft?: boolean;
    profileNotFound?: boolean;
    serverError?: boolean;
    deleteResult?: DeleteDraftProfileResult;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    noSlug = false,
    profileNotDraft = false,
    profileNotFound = false,
    serverError = false,
    deleteResult,
  }: SetupOptions = {}) {
    const defaultResult: DeleteDraftProfileResult = {
      slug: "test-slug",
      profileDeleted: true,
      profileImageDeleted: true,
      memberUpdated: true,
      hugoRebuildTriggered: true,
    };

    const mockDeleteDraftProfile = mock(
      (): Promise<DeleteDraftProfileResult> => {
        if (memberNotFound) {
          return Promise.reject(
            new NotFoundError(`Member with ID ${memberId} not found`),
          );
        }
        if (noSlug) {
          return Promise.reject(
            new ValidationError(
              "Member does not have a profile slug. Cannot delete draft profile.",
            ),
          );
        }
        if (profileNotDraft) {
          return Promise.reject(
            new ValidationError(
              'Profile for slug "test-slug" is published and cannot be deleted with this action.',
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
        return Promise.resolve(deleteResult ?? defaultResult);
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        deleteDraftProfile: mockDeleteDraftProfile,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/profile/delete-draft`,
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

    it("should return 403 when non-admin user tries to delete draft profile", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful delete", () => {
    it("should return deletion statuses and slug on success", async () => {
      const { testApp, request } = setup({
        deleteResult: {
          slug: "jane-doe",
          profileDeleted: true,
          profileImageDeleted: true,
          memberUpdated: true,
          hugoRebuildTriggered: true,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        slug?: string;
        profileDeleted?: boolean;
        profileImageDeleted?: boolean;
        memberUpdated?: boolean;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("jane-doe");
      expect(body.profileDeleted).toBe(true);
      expect(body.profileImageDeleted).toBe(true);
      expect(body.memberUpdated).toBe(true);
      expect(body.warning).toBeUndefined();
    });

    it("should return success when approval is cleared along with the draft profile", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        memberUpdated?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.memberUpdated).toBe(true);
    });

    it("should include warning when Hugo rebuild fails", async () => {
      const { testApp, request } = setup({
        deleteResult: {
          slug: "jane-doe",
          profileDeleted: true,
          profileImageDeleted: true,
          memberUpdated: true,
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

    it("should return 400 when profile is not draft", async () => {
      const { testApp, request } = setup({ profileNotDraft: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("published");
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
