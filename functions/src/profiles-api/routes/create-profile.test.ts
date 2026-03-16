import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { handleRequest } from "@doula-coop/functions-shared/test-utils/handle-request.js";
import { describe, expect, it, mock } from "bun:test";
import type { CreateProfileSuccessResponse } from "../schemas/profile-schemas.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /:slug (create profile).
 * Served at /api/profiles/:slug via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 */
describe("POST /:slug (create profile)", () => {
  const validProfileData = {
    title: "New Doula",
    bio: "This is a valid bio for a new doula profile.",
    credentials: "CD(DONA)",
    pronouns: "she/her",
    tags: ["birth-doula"],
    contact: {
      email: "new@example.com",
    },
    draft: false,
  };

  interface SetupOptions {
    // Request parameters
    slug?: string;
    body?: Record<string, unknown>;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    membershipNotActive?: boolean;
    memberHasNoSlug?: boolean;
    profileAlreadyExists?: boolean;
    storeError?: boolean;
    emailError?: boolean;
  }

  function setup({
    slug = "test-user",
    body = validProfileData,
    authToken = "valid-token",
    memberNotFound = false,
    membershipNotActive = false,
    memberHasNoSlug = false,
    profileAlreadyExists = false,
    storeError = false,
    emailError = false,
  }: SetupOptions = {}) {
    // Configure mocks based on scenario flags
    const mockVerifyMembership = mock(() => {
      if (memberNotFound) {
        return Promise.reject(
          new NotFoundError("No member document found for this user."),
        );
      }
      if (membershipNotActive) {
        return Promise.reject(
          new ForbiddenError("User does not have an active membership."),
        );
      }
      if (memberHasNoSlug) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { slug: _, ...memberWithoutSlug } = mockMemberDocument;
        return Promise.resolve(memberWithoutSlug);
      }
      return Promise.resolve(mockMemberDocument);
    });

    const mockCreateProfile = mock(() => {
      if (profileAlreadyExists) {
        return Promise.reject(
          new ConflictError("Profile already exists for this slug."),
        );
      }
      if (storeError) {
        return Promise.reject(new Error("Firestore write failed"));
      }
      return Promise.resolve({ success: true as const });
    });

    const mockSendEmail = mock(() => {
      if (emailError) {
        return Promise.reject(new Error("Mailgun API error"));
      }
      return Promise.resolve();
    });

    const testApp = createProfilesTestPlugin({
      profileMemberService: {
        verifyActiveMembership: mockVerifyMembership,
      },
      profileStoreService: {
        createProfile: mockCreateProfile,
      },
      emailService: {
        sendEmail: mockSendEmail,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${slug}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request, mockSendEmail };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const { testApp, request } = setup({
        slug: "me",
        authToken: "invalid-token",
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should allow authenticated user to create their profile", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(201);
    });
  });

  describe("Validation", () => {
    it("should return 422 when title is missing", async () => {
      const { testApp, request } = setup({
        slug: "me",
        body: { ...validProfileData, title: "" },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 422 when bio is missing", async () => {
      const { testApp, request } = setup({
        slug: "me",
        body: { ...validProfileData, bio: "" },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Membership verification", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    it("should return 403 when membership is not active", async () => {
      const { testApp, request } = setup({ membershipNotActive: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });

    it("should return 403 when user has no slug", async () => {
      const { testApp, request } = setup({ memberHasNoSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("slug");
    });
  });

  describe("Profile creation", () => {
    it("should return 201 on successful creation", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        success?: boolean;
        profile?: Record<string, unknown>;
      };
      expect(body.success).toBe(true);
    });

    it("should return profile data in response", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(201);
      const body = (await response.json()) as CreateProfileSuccessResponse;
      expect(body.profile).toBeDefined();
      expect(body.profile.title).toBe("New Doula");
      expect(body.profile.bio).toBe(
        "This is a valid bio for a new doula profile.",
      );
    });

    it("should return 409 when profile already exists", async () => {
      const { testApp, request } = setup({ profileAlreadyExists: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already exists");
    });
  });

  describe("Error handling", () => {
    it("should return 500 when store service throws unexpected error", async () => {
      const { testApp, request } = setup({ storeError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("Firestore write failed");
    });
  });

  describe("Email notification", () => {
    it("should send notification email on successful profile creation", async () => {
      const { testApp, request, mockSendEmail } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(201);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      // Verify the email includes the admin dashboard link
      const emailArgument = mockSendEmail.mock.calls[0] as unknown as [
        { message: { html: string } },
      ];
      expect(emailArgument[0].message.html).toContain(
        "members.doulacooperative.com/admin/members/",
      );
      expect(emailArgument[0].message.html).toContain(
        "Review in Admin Dashboard",
      );
    });

    it("should return 201 even when notification email fails", async () => {
      const { testApp, request, mockSendEmail } = setup({ emailError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(201);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("should not send notification email when profile creation fails", async () => {
      const { testApp, request, mockSendEmail } = setup({
        profileAlreadyExists: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
