import { beforeEach, describe, expect, it, mock } from "bun:test";
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
 * Tests for PUT /me (update profile).
 * Served at /api/profiles/me via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("PUT /me (update profile)", () => {
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

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const testApp = createProfilesTestPlugin();

      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const testApp = createProfilesTestPlugin();

      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer invalid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should allow authenticated user to update their profile", async () => {
      const testApp = createProfilesTestPlugin();

      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("should return 422 when title is missing", async () => {
      const testApp = createProfilesTestPlugin();
      const invalidData = { ...validProfileData, title: "" };

      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(invalidData),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when bio is missing", async () => {
      const testApp = createProfilesTestPlugin();
      const invalidData = { ...validProfileData, bio: "" };

      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(invalidData),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when title exceeds max length", async () => {
      const testApp = createProfilesTestPlugin();
      const invalidData = { ...validProfileData, title: "a".repeat(201) };

      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(invalidData),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Membership verification", () => {
    it("should return 404 when member not found", async () => {
      const mockVerifyMembership = mock(() => {
        return Promise.reject(
          new NotFoundError("No member document found for this user."),
        );
      });

      const notFoundTestApp = createProfilesTestPlugin({
        profileMemberService: {
          verifyActiveMembership: mockVerifyMembership,
        },
      });

      const response = (await notFoundTestApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(404);
    });

    it("should return 403 when membership is not active", async () => {
      const mockVerifyMembership = mock(() => {
        return Promise.reject(
          new ForbiddenError("User does not have an active membership."),
        );
      });

      const inactiveTestApp = createProfilesTestPlugin({
        profileMemberService: {
          verifyActiveMembership: mockVerifyMembership,
        },
      });

      const response = (await inactiveTestApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("active membership");
    });

    it("should return 403 when user has no slug (no profile yet)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { slug, ...memberWithoutSlug } = mockMemberDocument;

      const mockVerifyMembership = mock(() =>
        Promise.resolve(memberWithoutSlug),
      );

      const noSlugTestApp = createProfilesTestPlugin({
        profileMemberService: {
          verifyActiveMembership: mockVerifyMembership,
        },
      });

      const response = (await noSlugTestApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Profile not found");
    });
  });

  describe("Profile update", () => {
    it("should return success on successful update", async () => {
      const testApp = createProfilesTestPlugin();

      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it("should return 409 when GitHub conflict occurs", async () => {
      const mockWriteProfile = mock(() => {
        return Promise.reject(new ConflictError("Profile was modified"));
      });

      const conflictTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          writeProfile: mockWriteProfile,
        },
      });

      const response = (await conflictTestApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(409);
    });
  });

  describe("Error handling", () => {
    it("should return 500 when GitHub service throws unexpected error", async () => {
      const mockWriteProfile = mock(() => {
        return Promise.reject(new Error("GitHub API rate limit exceeded"));
      });

      const errorTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          writeProfile: mockWriteProfile,
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify(validProfileData),
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("rate limit");
    });
  });
});
