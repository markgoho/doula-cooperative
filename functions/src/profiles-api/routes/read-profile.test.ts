import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { MemberDocument } from "../../collections/index.js";
import {
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
  mockProfileData,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for GET /me (read profile).
 * Served at /api/profiles/me via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET /me (read profile)", () => {
  const testApp = createProfilesTestPlugin();

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });

    it("should return 401 when token is expired", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer expired-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("session has expired");
    });

    it("should allow authenticated user to read their profile", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
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
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("No member document found");
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
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("active membership");
    });

    it("should return 403 when user has no slug (no profile yet)", async () => {
      const memberWithoutSlug: MemberDocument = {
        ...mockMemberDocument,
        slug: undefined,
      };

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
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("does not have a profile yet");
    });
  });

  describe("Profile retrieval", () => {
    it("should return structured profile data on success", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as ProfileData;
      expect(body.title).toBe("Test Doula");
      expect(body.bio).toBe("This is a test bio for the doula profile.");
      expect(body.credentials).toBe("CD(DONA)");
      expect(body.pronouns).toBe("she/her");
      expect(body.tags).toEqual(["birth-doula", "postpartum"]);
      expect(body.contact?.email).toBe("test@example.com");
    });

    it("should include image URL when available", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      const body = (await response.json()) as ProfileData;
      expect(body.image).toBe("https://example.com/image.jpg");
    });

    it("should not include image when not available", async () => {
      const mockReadProfile = mock(() =>
        Promise.resolve({
          ...mockProfileData,
        }),
      );

      const noImageTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          readProfile: mockReadProfile,
        },
      });

      const response = (await noImageTestApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      const body = (await response.json()) as ProfileData;
      expect(body.title).toBeDefined();
      expect(body.image).toBeUndefined();
    });
  });

  describe("Error handling", () => {
    it("should return 404 when profile not found on GitHub", async () => {
      const mockReadProfile = mock(() => {
        return Promise.reject(new NotFoundError("Profile not found"));
      });

      const notFoundTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          readProfile: mockReadProfile,
        },
      });

      const response = (await notFoundTestApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 500 when GitHub service throws unexpected error", async () => {
      const mockReadProfile = mock(() => {
        return Promise.reject(new Error("GitHub API rate limit exceeded"));
      });

      const errorTestApp = createProfilesTestPlugin({
        profileGitHubService: {
          readProfile: mockReadProfile,
        },
      });

      const response = (await errorTestApp.handle(
        new Request("http://localhost/me", {
          headers: {
            Authorization: "Bearer valid-token",
          },
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
