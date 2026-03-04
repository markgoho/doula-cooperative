import { describe, expect, it, mock } from "bun:test";
import type { ProfileDocument } from "../../collections/index.js";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { ReadProfileResult } from "../services/read-profile.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /:memberId/profile.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("GET /:memberId/profile", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    memberNotFound?: boolean;
    noSlug?: boolean;
    profileNotFound?: boolean;
    serverError?: boolean;
    profileResult?: ReadProfileResult;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    noSlug = false,
    profileNotFound = false,
    serverError = false,
    profileResult,
  }: SetupOptions = {}) {
    const defaultProfile: ProfileDocument = {
      title: "Jane Doe - Doula Services",
      bio: "Experienced doula providing support.",
      credentials: "CD(DONA)",
      pronouns: "she/her",
      tags: ["birth-doula", "postpartum"],
      contact: {
        email: "jane@example.com",
        phone: "555-1234",
      },
      draft: false,
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-06-01T14:30:00.000Z",
      ownerUid: "test-member-id",
    };

    const defaultResult: ReadProfileResult = {
      slug: "jane-doe",
      profile: defaultProfile,
    };

    const mockReadProfile = mock((): Promise<ReadProfileResult> => {
      if (memberNotFound) {
        return Promise.reject(
          new NotFoundError(`Member with ID ${memberId} not found`),
        );
      }
      if (noSlug) {
        return Promise.reject(
          new ValidationError(
            "Member does not have a profile slug. Cannot read profile.",
          ),
        );
      }
      if (profileNotFound) {
        return Promise.reject(
          new NotFoundError("Profile not found for slug: jane-doe"),
        );
      }
      if (serverError) {
        return Promise.reject(new Error("Firestore unavailable"));
      }
      return Promise.resolve(profileResult ?? defaultResult);
    });

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        readProfile: mockReadProfile,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/profile`, {
      method: "GET",
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

    it("should return 403 when non-admin user tries to read profile", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful read", () => {
    it("should return profile data with success response", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        slug?: string;
        profile?: {
          title?: string;
          bio?: string;
          credentials?: string;
          pronouns?: string;
          tags?: string[];
          contact?: { email?: string; phone?: string };
          draft?: boolean;
          createdAt?: string;
          updatedAt?: string;
          ownerUid?: string;
        };
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("jane-doe");
      expect(body.profile?.title).toBe("Jane Doe - Doula Services");
      expect(body.profile?.bio).toBe("Experienced doula providing support.");
      expect(body.profile?.credentials).toBe("CD(DONA)");
      expect(body.profile?.pronouns).toBe("she/her");
      expect(body.profile?.tags).toEqual(["birth-doula", "postpartum"]);
      expect(body.profile?.contact?.email).toBe("jane@example.com");
      expect(body.profile?.draft).toBe(false);
      expect(body.profile?.createdAt).toBe("2024-01-15T10:00:00.000Z");
      expect(body.profile?.updatedAt).toBe("2024-06-01T14:30:00.000Z");
      expect(body.profile?.ownerUid).toBe("test-member-id");
    });

    it("should return draft profile data", async () => {
      const { testApp, request } = setup({
        profileResult: {
          slug: "new-doula",
          profile: {
            title: "New Doula",
            bio: "Just getting started.",
            draft: true,
            createdAt: "2024-06-01T00:00:00.000Z",
            updatedAt: "2024-06-01T00:00:00.000Z",
          },
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        slug?: string;
        profile?: {
          title?: string;
          draft?: boolean;
        };
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("new-doula");
      expect(body.profile?.title).toBe("New Doula");
      expect(body.profile?.draft).toBe(true);
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
