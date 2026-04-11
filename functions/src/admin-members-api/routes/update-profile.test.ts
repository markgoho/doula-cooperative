import { describe, expect, it, mock } from "bun:test";
import type { ProfileDocument } from "../../collections/index.js";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { UpdateProfileResult } from "../services/update-profile.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("PUT /:memberId/profile", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    body?: Record<string, unknown>;
    memberNotFound?: boolean;
    noSlug?: boolean;
    profileNotFound?: boolean;
    serverError?: boolean;
    profileResult?: UpdateProfileResult;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "admin-token",
    body = {
      title: "Jane Doe - Updated Doula Services",
      bio: "Updated support for families.",
    },
    memberNotFound = false,
    noSlug = false,
    profileNotFound = false,
    serverError = false,
    profileResult,
  }: SetupOptions = {}) {
    const defaultProfile: ProfileDocument = {
      title: "Jane Doe - Updated Doula Services",
      bio: "Updated support for families.",
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
      image:
        "https://ik.imagekit.io/doulacoop/doulas/jane-doe/jane-doe-profile",
    };

    const defaultResult: UpdateProfileResult = {
      slug: "jane-doe",
      profile: defaultProfile,
    };

    const mockUpdateProfile = mock((): Promise<UpdateProfileResult> => {
      if (memberNotFound) {
        return Promise.reject(
          new NotFoundError(`Member with ID ${memberId} not found`),
        );
      }
      if (noSlug) {
        return Promise.reject(
          new ValidationError(
            "Member does not have a profile slug. Cannot update profile.",
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
        updateProfile: mockUpdateProfile,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/profile`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
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

    it("should return 403 when non-admin user tries to update profile", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Validation", () => {
    it("should return 422 when request body is invalid", async () => {
      const { testApp, request } = setup({
        body: {
          title: "",
          bio: "Valid bio",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Successful update", () => {
    it("should return updated profile data with success response", async () => {
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
          image?: string;
        };
      };
      expect(body.success).toBe(true);
      expect(body.slug).toBe("jane-doe");
      expect(body.profile?.title).toBe("Jane Doe - Updated Doula Services");
      expect(body.profile?.bio).toBe("Updated support for families.");
      expect(body.profile?.credentials).toBe("CD(DONA)");
      expect(body.profile?.pronouns).toBe("she/her");
      expect(body.profile?.tags).toEqual(["birth-doula", "postpartum"]);
      expect(body.profile?.contact?.email).toBe("jane@example.com");
      expect(body.profile?.image).toBe(
        "https://ik.imagekit.io/doulacoop/doulas/jane-doe/jane-doe-profile",
      );
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
