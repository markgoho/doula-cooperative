import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  ConflictError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import type { ChangeSlugResult } from "../services/change-slug.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/profile/change-slug.
 * Served at /api/admin/members/:memberId/profile/change-slug via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/profile/change-slug", () => {
  interface SetupOptions {
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;

    memberNotFound?: boolean;
    memberHasNoSlug?: boolean;
    profileNotFound?: boolean;
    newSlugTaken?: boolean;
    sameSlug?: boolean;
    serverError?: boolean;
    isAdminLookupFails?: boolean;
    imageMoveWarning?: string;
  }

  function setup({
    body = { newSlug: "new-doula-slug" },
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    memberHasNoSlug = false,
    profileNotFound = false,
    newSlugTaken = false,
    sameSlug = false,
    serverError = false,
    isAdminLookupFails = false,
    imageMoveWarning,
  }: SetupOptions = {}) {
    const defaultMember: MemberDocument = {
      uid: memberId,
      email: "member@example.com",
      createdAt: Timestamp.now(),
      membershipActive: true,
      subscriptionStart: Timestamp.now(),
      membershipExpiresAt: Timestamp.now(),
      slug: "new-doula-slug",
      profileCreatedAt: Timestamp.now(),
      profileApprovedAt: Timestamp.now(),
    };

    const mockChangeSlug = mock(
      (options: {
        memberId: string;
        newSlug: string;
      }): Promise<ChangeSlugResult> => {
        if (memberNotFound) {
          return Promise.reject(
            new NotFoundError(`Member with ID ${options.memberId} not found`),
          );
        }
        if (memberHasNoSlug) {
          return Promise.reject(
            new ConflictError("Member does not have a profile slug to change."),
          );
        }
        if (sameSlug) {
          return Promise.reject(
            new ConflictError(
              "New slug must be different from the current slug.",
            ),
          );
        }
        if (profileNotFound) {
          return Promise.reject(
            new NotFoundError("Profile not found for slug: old-doula-slug"),
          );
        }
        if (newSlugTaken) {
          return Promise.reject(
            new ConflictError(`Slug "${options.newSlug}" is already taken.`),
          );
        }
        if (serverError) {
          return Promise.reject(new Error("Firestore unavailable"));
        }
        return Promise.resolve({
          member: { ...defaultMember, uid: options.memberId },
          oldSlug: "old-doula-slug",
          newSlug: options.newSlug,
          ...(imageMoveWarning !== undefined && { imageMoveWarning }),
        });
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        changeSlug: mockChangeSlug,
        isAdmin: mock((): Promise<boolean> => {
          if (isAdminLookupFails) {
            return Promise.reject(new Error("Auth lookup unavailable"));
          }
          return Promise.resolve(false);
        }),
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/profile/change-slug`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
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

    it("should return 403 when non-admin user tries to change slug", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful change", () => {
    it("should return success with member data and old/new slugs", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { uid?: string; slug?: string };
        oldSlug?: string;
        newSlug?: string;
        imageMoveWarning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.member?.uid).toBe("test-member-id");
      expect(body.member?.slug).toBe("new-doula-slug");
      expect(body.oldSlug).toBe("old-doula-slug");
      expect(body.newSlug).toBe("new-doula-slug");
      expect(body.imageMoveWarning).toBeUndefined();
    });

    it("should pass through imageMoveWarning when the image move fails", async () => {
      const { testApp, request } = setup({
        imageMoveWarning:
          "Profile image could not be moved to the new slug and may need manual attention.",
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { imageMoveWarning?: string };
      expect(body.imageMoveWarning).toBe(
        "Profile image could not be moved to the new slug and may need manual attention.",
      );
    });

    it("should still return success when isAdmin lookup fails after changing slug", async () => {
      const { testApp, request } = setup({ isAdminLookupFails: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { isAdmin?: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.member?.isAdmin).toBe(false);
    });
  });

  describe("Validation errors", () => {
    it("should reject an invalid new slug format at the schema level", async () => {
      const { testApp, request } = setup({
        body: { newSlug: "Invalid Slug!" },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 409 when member has no existing slug", async () => {
      const { testApp, request } = setup({ memberHasNoSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("does not have a profile slug");
    });

    it("should return 409 when new slug matches the current slug", async () => {
      const { testApp, request } = setup({ sameSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("must be different");
    });

    it("should return 404 when the existing profile is not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Profile not found");
    });

    it("should return 409 when the new slug is already taken", async () => {
      const { testApp, request } = setup({ newSlugTaken: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already taken");
    });
  });

  describe("Error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain("Firestore unavailable");
      expect(body.error).toContain("change member profile slug");
    });
  });
});
