import { describe, expect, it, mock } from "bun:test";
import {
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /slugs/link-request (request an admin link an existing
 * unowned profile, instead of creating a duplicate).
 * Served at /api/profiles/slugs/link-request via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 */
describe("POST /slugs/link-request (request profile link)", () => {
  interface SetupOptions {
    body?: { slug: string };
    authToken?: string | null;
    memberNotFound?: boolean;
    membershipNotActive?: boolean;
    memberAlreadyHasSlug?: boolean;
    unownedMatch?: boolean;
    emailError?: boolean;
    serverError?: boolean;
  }

  function setup({
    body = { slug: "megan-stavalone" },
    authToken = "valid-token",
    memberNotFound = false,
    membershipNotActive = false,
    memberAlreadyHasSlug = false,
    unownedMatch = true,
    emailError = false,
    serverError = false,
  }: SetupOptions = {}) {
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
      if (memberAlreadyHasSlug) {
        return Promise.resolve({ ...mockMemberDocument });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { slug: _, ...memberWithoutSlug } = mockMemberDocument;
      return Promise.resolve(memberWithoutSlug);
    });

    const mockCheckSlugAvailable = mock(() => {
      if (serverError) {
        return Promise.reject(new Error("Firestore connection failed"));
      }
      if (unownedMatch) {
        return Promise.resolve({
          available: false,
          unownedMatch: { slug: body.slug, title: "Megan Stavalone" },
        });
      }
      return Promise.resolve({ available: false });
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
        checkSlugAvailable: mockCheckSlugAvailable,
      },
      emailService: {
        sendEmail: mockSendEmail,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/slugs/link-request", {
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
    });

    it("should allow authenticated user to request a link", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
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

    it("should return 409 when member already has a slug", async () => {
      const { testApp, request } = setup({ memberAlreadyHasSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already have a profile slug");
    });
  });

  describe("Profile availability re-check", () => {
    it("should return 409 when the slug no longer matches an unowned profile", async () => {
      const { testApp, request } = setup({ unownedMatch: false });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("no longer available to link");
    });
  });

  describe("Email notification", () => {
    it("should send an admin notification email on success", async () => {
      const { testApp, request, mockSendEmail } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const emailArgument = mockSendEmail.mock.calls[0] as unknown as [
        { message: { html: string } },
      ];
      expect(emailArgument[0].message.html).toContain(
        "members.doulacooperative.com/admin/members/",
      );
      expect(emailArgument[0].message.html).toContain("Link Existing Profile");
    });

    it("should return 200 even when the notification email fails", async () => {
      const { testApp, request, mockSendEmail } = setup({ emailError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("should not send an email when the slug is no longer an unowned match", async () => {
      const { testApp, request, mockSendEmail } = setup({
        unownedMatch: false,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain("Firestore");
    });
  });
});
