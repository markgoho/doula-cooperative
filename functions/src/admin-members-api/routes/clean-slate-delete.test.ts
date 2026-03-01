import { describe, expect, it, mock } from "bun:test";
import {
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { CleanSlateResult } from "../services/clean-slate-delete.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/clean-slate.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/clean-slate", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    selfDeletion?: boolean;
    deletingAdminUser?: boolean;
    memberNotFound?: boolean;
    cleanSlateResult?: CleanSlateResult;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "admin-token",
    selfDeletion = false,
    deletingAdminUser = false,
    memberNotFound = false,
    cleanSlateResult,
  }: SetupOptions = {}) {
    const defaultResult: CleanSlateResult = {
      deletedUid: memberId,
      memberDocumentDeleted: true,
      authUserDeleted: true,
    };

    const mockCleanSlateDelete = mock(
      (options: {
        memberId: string;
        requestingAdminUid: string;
      }): Promise<CleanSlateResult> => {
        if (
          selfDeletion ||
          options.memberId === options.requestingAdminUid ||
          options.memberId === "admin-user"
        ) {
          return Promise.reject(
            new ForbiddenError("You cannot delete your own account"),
          );
        }
        if (deletingAdminUser || options.memberId === "admin-member-id") {
          return Promise.reject(
            new ForbiddenError(
              "Cannot delete admin users. Remove admin privileges first.",
            ),
          );
        }
        if (memberNotFound || options.memberId === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        return Promise.resolve(cleanSlateResult ?? defaultResult);
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        cleanSlateDelete: mockCleanSlateDelete,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/clean-slate`, {
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

    it("should return 403 when non-admin user tries to clean slate delete", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Deletion guards", () => {
    it("should prevent self-deletion", async () => {
      const { testApp, request } = setup({ memberId: "admin-user" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You cannot delete your own account");
    });

    it("should prevent deleting other admin users", async () => {
      const { testApp, request } = setup({ memberId: "admin-member-id" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "Cannot delete admin users. Remove admin privileges first.",
      );
    });
  });

  describe("Successful clean slate delete", () => {
    it("should clean slate delete and return success response", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        deletedUid?: string;
        memberDocumentDeleted?: boolean;
        authUserDeleted?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.deletedUid).toBe("test-member-id");
      expect(body.memberDocumentDeleted).toBe(true);
      expect(body.authUserDeleted).toBe(true);
    });

    it("should include external system cleanup results", async () => {
      const { testApp, request } = setup({
        cleanSlateResult: {
          deletedUid: "test-member-id",
          subscriptionCanceled: true,
          stripeCustomerDeleted: true,
          newsletterUnsubscribed: true,
          profileDeleted: true,
          profileImageDeleted: true,
          memberDocumentDeleted: true,
          authUserDeleted: true,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        subscriptionCanceled?: boolean;
        stripeCustomerDeleted?: boolean;
        newsletterUnsubscribed?: boolean;
        profileDeleted?: boolean;
        profileImageDeleted?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.subscriptionCanceled).toBe(true);
      expect(body.stripeCustomerDeleted).toBe(true);
      expect(body.newsletterUnsubscribed).toBe(true);
      expect(body.profileDeleted).toBe(true);
      expect(body.profileImageDeleted).toBe(true);
    });

    it("should include warning when non-critical actions fail", async () => {
      const { testApp, request } = setup({
        cleanSlateResult: {
          deletedUid: "test-member-id",
          subscriptionCanceled: false,
          stripeCustomerDeleted: false,
          memberDocumentDeleted: true,
          authUserDeleted: true,
          warning:
            "Non-critical actions failed: Cancel Stripe subscription failed",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.warning).toContain("Non-critical actions failed");
    });
  });

  describe("Error handling", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberId: "non-existent-id" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });

    it("should return 500 for unexpected errors", async () => {
      const mockCleanSlateDelete = mock(
        (): Promise<CleanSlateResult> =>
          Promise.reject(new Error("Unexpected error")),
      );

      const testApp = createAdminTestPlugin({
        memberAdminService: {
          cleanSlateDelete: mockCleanSlateDelete,
        },
      });

      const request = new Request(
        "http://localhost/test-member-id/clean-slate",
        {
          method: "POST",
          headers: { Authorization: "Bearer admin-token" },
        },
      );

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
    });
  });
});
