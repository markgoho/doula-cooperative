import { describe, expect, it, mock } from "bun:test";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for PUT /:slug (update profile).
 * Served at /api/profiles/:slug via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("PUT /:slug (update profile)", () => {
  const validProfileData = {
    title: "Test Doula",
    bio: "This is a valid bio for the test doula profile.",
    credentials: "CD(DONA)",
    pronouns: "she/her",
    tags: ["birth-doula", "postpartum"],
    contact: {
      email: "test@example.com",
      phone: "555-0123",
    },
    draft: false,
  };

  interface SetupOptions {
    slug?: string;
    body?: Record<string, unknown>;
    authToken?: string | null;
    memberNotFound?: boolean;
    membershipInactive?: boolean;
    memberHasNoSlug?: boolean;
    conflictError?: boolean;
    serverError?: boolean;
  }

  function setup({
    slug = "test-user",
    body = validProfileData,
    authToken = "valid-token",
    memberNotFound = false,
    membershipInactive = false,
    memberHasNoSlug = false,
    conflictError = false,
    serverError = false,
  }: SetupOptions = {}) {
    const mockVerifyMembership = mock(() => {
      if (memberNotFound) {
        return Promise.reject(
          new NotFoundError("No member document found for this user."),
        );
      }
      if (membershipInactive) {
        return Promise.reject(
          new ForbiddenError("User does not have an active membership."),
        );
      }
      if (memberHasNoSlug) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { slug: _slug, ...memberWithoutSlug } = mockMemberDocument;
        return Promise.resolve(memberWithoutSlug);
      }
      return Promise.resolve(mockMemberDocument);
    });

    const mockWriteProfile = mock(() => {
      if (conflictError) {
        return Promise.reject(new ConflictError("Profile was modified"));
      }
      if (serverError) {
        return Promise.reject(new Error("GitHub API rate limit exceeded"));
      }
      return Promise.resolve();
    });

    const testApp = createProfilesTestPlugin({
      profileMemberService: {
        verifyActiveMembership: mockVerifyMembership,
      },
      profileGitHubService: {
        writeProfile: mockWriteProfile,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${slug}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

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

    it("should return 401 when token is invalid", async () => {
      const { testApp, request } = setup({ authToken: "invalid-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
    });

    it("should allow authenticated user to update their profile", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("should return 422 when title is missing", async () => {
      const { testApp, request } = setup({
        body: { ...validProfileData, title: "" },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when bio is missing", async () => {
      const { testApp, request } = setup({
        body: { ...validProfileData, bio: "" },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when title exceeds max length", async () => {
      const { testApp, request } = setup({
        body: { ...validProfileData, title: "a".repeat(201) },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Membership verification", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
    });

    it("should return 403 when membership is not active", async () => {
      const { testApp, request } = setup({ membershipInactive: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("active membership");
    });

    it("should return 403 when user has no slug (no profile yet)", async () => {
      const { testApp, request } = setup({ memberHasNoSlug: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Profile not found");
    });
  });

  describe("Profile update", () => {
    it("should return success on successful update", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it("should return 409 when GitHub conflict occurs", async () => {
      const { testApp, request } = setup({ conflictError: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(409);
    });
  });

  describe("Error handling", () => {
    it("should return 500 when GitHub service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("rate limit");
    });
  });
});
