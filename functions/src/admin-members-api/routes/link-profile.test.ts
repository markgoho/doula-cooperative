import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import type { MemberAdminService } from "../services/interface.js";
import type { LinkProfileResult } from "../services/link-profile.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/profile/link.
 * Served at /api/admin/members/:memberId/profile/link via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/profile/link", () => {
  interface SetupOptions {
    // Request parameters
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    memberAlreadyHasSlug?: boolean;
    profileNotFound?: boolean;
    profileAlreadyLinked?: boolean;
    serverError?: boolean;
    isAdminLookupFails?: boolean;
    legacyEmail?: string | null;
    legacyLookupFailed?: boolean;
    carryOverFails?: boolean;
    shouldFailDeleteLegacyMembership?: boolean;
  }

  function setup({
    body = { slug: "unlinked-doula-profile" },
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    memberAlreadyHasSlug = false,
    profileNotFound = false,
    profileAlreadyLinked = false,
    serverError = false,
    isAdminLookupFails = false,
    legacyEmail = "Legacy.Doula@example.com",
    legacyLookupFailed = false,
    carryOverFails = false,
    shouldFailDeleteLegacyMembership = false,
  }: SetupOptions = {}) {
    const defaultMember: MemberDocument = {
      uid: memberId,
      email: "member@example.com",
      createdAt: Timestamp.now(),
      membershipActive: true,
      subscriptionStart: Timestamp.now(),
      membershipExpiresAt: Timestamp.now(),
      slug: "unlinked-doula-profile",
      profileCreatedAt: Timestamp.now(),
      profileApprovedAt: Timestamp.now(),
    };

    const mockLinkProfile = mock(
      (options: {
        memberId: string;
        slug: string;
      }): Promise<LinkProfileResult> => {
        if (memberNotFound) {
          return Promise.reject(
            new NotFoundError(`Member with ID ${options.memberId} not found`),
          );
        }
        if (memberAlreadyHasSlug) {
          return Promise.reject(
            new ValidationError(
              "Member already has a linked profile with slug: existing-slug",
            ),
          );
        }
        if (profileNotFound) {
          return Promise.reject(
            new NotFoundError(`Profile not found for slug: ${options.slug}`),
          );
        }
        if (profileAlreadyLinked) {
          return Promise.reject(
            new ValidationError(
              `Profile "${options.slug}" is already linked to member: other-uid`,
            ),
          );
        }
        if (serverError) {
          return Promise.reject(new Error("Firestore unavailable"));
        }
        return Promise.resolve({
          member: { ...defaultMember, uid: options.memberId },
          ...(legacyEmail !== null && { legacyEmail }),
          ...(legacyLookupFailed && { legacyLookupFailed: true as const }),
        });
      },
    );

    const mockCarryOverOfflineResponses = mock<
      MemberAdminService["carryOverOfflineResponses"]
    >(() =>
      carryOverFails
        ? Promise.reject(new Error("Firestore unavailable"))
        : Promise.resolve({ carried: 2 }),
    );
    const mockDeleteLegacyMembership = mock<
      MemberAdminService["deleteLegacyMembership"]
    >(() =>
      shouldFailDeleteLegacyMembership
        ? Promise.reject(new Error("Firestore unavailable"))
        : Promise.resolve(),
    );
    const mockSendEmail = mock(() => Promise.resolve());

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        linkProfile: mockLinkProfile,
        carryOverOfflineResponses: mockCarryOverOfflineResponses,
        deleteLegacyMembership: mockDeleteLegacyMembership,
        isAdmin: mock((): Promise<boolean> => {
          if (isAdminLookupFails) {
            return Promise.reject(new Error("Auth lookup unavailable"));
          }
          return Promise.resolve(false);
        }),
      },
      emailService: { sendEmail: mockSendEmail },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/profile/link`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return {
      testApp,
      request,
      mockCarryOverOfflineResponses,
      mockDeleteLegacyMembership,
      mockSendEmail,
    };
  }

  interface LinkBody {
    success?: boolean;
    member?: { uid?: string; slug?: string };
    offlineResponsesCarried?: boolean;
    warning?: string;
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to link profile", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful link", () => {
    it("should return success with member data", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: {
          uid?: string;
          email?: string;
          membershipActive?: boolean;
          slug?: string;
          profileApprovedAt?: string;
          isAdmin?: boolean;
        };
      };
      expect(body.success).toBe(true);
      expect(body.member?.uid).toBe("test-member-id");
      expect(body.member?.email).toBe("member@example.com");
      expect(body.member?.slug).toBe("unlinked-doula-profile");
      expect(body.member?.profileApprovedAt).toBeDefined();
      expect(body.member?.isAdmin).toBe(false);
    });

    it("should still return success when isAdmin lookup fails after linking", async () => {
      const { testApp, request } = setup({ isAdminLookupFails: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: {
          uid?: string;
          slug?: string;
          isAdmin?: boolean;
        };
      };
      expect(body.success).toBe(true);
      expect(body.member?.uid).toBe("test-member-id");
      expect(body.member?.slug).toBe("unlinked-doula-profile");
      expect(body.member?.isAdmin).toBe(false);
    });
  });

  describe("Offline Responses carry-over", () => {
    it("carries the Legacy Membership's Offline Responses over to the Member, then deletes its import record", async () => {
      const {
        testApp,
        request,
        mockCarryOverOfflineResponses,
        mockDeleteLegacyMembership,
        mockSendEmail,
      } = setup({ legacyEmail: "Legacy.Doula@example.com" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as LinkBody;
      expect(body.success).toBe(true);
      expect(body.offlineResponsesCarried).toBe(true);
      expect(body.warning).toBeUndefined();
      expect(mockCarryOverOfflineResponses).toHaveBeenCalledTimes(1);
      expect(mockCarryOverOfflineResponses.mock.calls[0]?.[0]).toMatchObject({
        memberUid: "test-member-id",
        legacyEmail: "Legacy.Doula@example.com",
      });
      expect(mockDeleteLegacyMembership).toHaveBeenCalledWith({
        legacyEmail: "Legacy.Doula@example.com",
      });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("reports nothing to carry over when no Legacy Membership matches the profile", async () => {
      const {
        testApp,
        request,
        mockCarryOverOfflineResponses,
        mockDeleteLegacyMembership,
      } = setup({ legacyEmail: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as LinkBody;
      expect(body.offlineResponsesCarried).toBe(true);
      expect(mockCarryOverOfflineResponses).not.toHaveBeenCalled();
      expect(mockDeleteLegacyMembership).not.toHaveBeenCalled();
    });

    it("still links, warns, emails admins, and still deletes the import record when the carry-over fails", async () => {
      const { testApp, request, mockDeleteLegacyMembership, mockSendEmail } =
        setup({ carryOverFails: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as LinkBody;
      expect(body.success).toBe(true);
      expect(body.member?.slug).toBe("unlinked-doula-profile");
      expect(body.offlineResponsesCarried).toBe(false);
      expect(body.warning).toContain(
        "Offline Responses could not be carried over",
      );
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockDeleteLegacyMembership).toHaveBeenCalledTimes(1);
    });

    it("tells admins to carry a Coordinator-recorded Outcome over by hand, without overwriting the Member's own", async () => {
      const { testApp, request, mockSendEmail } = setup({
        carryOverFails: true,
      });

      await handleRequest(testApp, request);

      const email = JSON.stringify(mockSendEmail.mock.calls[0]);
      expect(email).toContain("unless they already have one");
      expect(email).toContain(
        "copy any outcome and outcomeUpdatedAt to the Member",
      );
    });

    it("still links, warns, and emails admins when the Legacy Membership lookup fails", async () => {
      const { testApp, request, mockCarryOverOfflineResponses, mockSendEmail } =
        setup({ legacyEmail: null, legacyLookupFailed: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as LinkBody;
      expect(body.success).toBe(true);
      expect(body.offlineResponsesCarried).toBe(false);
      expect(body.warning).toBeDefined();
      expect(mockCarryOverOfflineResponses).not.toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it("still reports the carry-over when deleting the import record fails", async () => {
      const { testApp, request, mockSendEmail } = setup({
        shouldFailDeleteLegacyMembership: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as LinkBody;
      expect(body.offlineResponsesCarried).toBe(true);
      expect(body.warning).toBeUndefined();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("does not carry anything over when the link fails", async () => {
      const { testApp, request, mockCarryOverOfflineResponses } = setup({
        profileAlreadyLinked: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      expect(mockCarryOverOfflineResponses).not.toHaveBeenCalled();
    });
  });

  describe("Validation errors", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 400 when member already has a linked profile", async () => {
      const { testApp, request } = setup({ memberAlreadyHasSlug: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already has a linked profile");
    });

    it("should return 404 when profile not found", async () => {
      const { testApp, request } = setup({ profileNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Profile not found");
    });

    it("should return 400 when profile is already linked to another member", async () => {
      const { testApp, request } = setup({ profileAlreadyLinked: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already linked to member");
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
      expect(body.error).toContain("link profile to member");
    });
  });
});
