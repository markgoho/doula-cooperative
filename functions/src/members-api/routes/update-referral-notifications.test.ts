import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

/**
 * Tests for PATCH /:memberId/referral-notifications (Referral Notification opt-out).
 */
describe("PATCH /:memberId/referral-notifications", () => {
  interface SetupOptions {
    body?: unknown;
    memberId?: string;
    authToken?: string | null;
    memberNotFound?: boolean;
    serverError?: boolean;
  }

  function setup({
    body = { enabled: false },
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    memberNotFound = false,
    serverError = false,
  }: SetupOptions = {}) {
    const mockUpdateReferralNotifications = mock(
      (id: string, isEnabled: boolean): Promise<MemberDocument> => {
        if (serverError) {
          return Promise.reject(new Error("Firestore connection error"));
        }
        if (memberNotFound) {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        return Promise.resolve({
          uid: id,
          email: "test@example.com",
          createdAt: Timestamp.fromDate(new Date("2024-01-01")),
          referralNotificationsEnabled: isEnabled,
        });
      },
    );

    const mockVerifyOwnerOrAdmin = mock(
      (
        authorizationHeader: string | undefined,
        targetMemberId: string,
      ): Promise<DecodedIdToken> => {
        if (!authorizationHeader) {
          return Promise.reject(new AuthError("Missing Authorization header"));
        }
        if (
          authorizationHeader === "Bearer valid-owner-token" &&
          targetMemberId === "test-member-id"
        ) {
          return Promise.resolve({
            uid: "test-member-id",
          } as DecodedIdToken);
        }
        if (authorizationHeader === "Bearer admin-token") {
          return Promise.resolve({
            uid: "admin-user",
            admin: true,
          } as unknown as DecodedIdToken);
        }
        if (authorizationHeader === "Bearer non-owner-token") {
          return Promise.reject(
            new ForbiddenError("You can only access your own data"),
          );
        }
        return Promise.reject(new AuthError("Invalid authentication token"));
      },
    );

    const logger = {
      error: mock(),
      warn: mock(),
      info: mock(),
    } satisfies Logger;

    const testApp = createMembersTestPlugin({
      memberService: {
        updateReferralNotifications: mockUpdateReferralNotifications,
      },
      authService: { verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin },
      logger,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/referral-notifications`,
      { method: "PATCH", headers, body: JSON.stringify(body) },
    );

    return { testApp, request, mockUpdateReferralNotifications, logger };
  }

  describe("Authentication", () => {
    it("returns 401 without an authorization header", async () => {
      const { testApp, request, mockUpdateReferralNotifications } = setup({
        authToken: null,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      expect(mockUpdateReferralNotifications).not.toHaveBeenCalled();
    });

    it("returns 403 for another member", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });

    it("returns 403 when an Admin tries to change another member's preference", async () => {
      const { testApp, request, mockUpdateReferralNotifications } = setup({
        authToken: "admin-token",
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe(
        "You can only change your own referral email preference",
      );
      expect(mockUpdateReferralNotifications).not.toHaveBeenCalled();
    });
  });

  describe("Updating the preference", () => {
    it("turns Referral Notifications off for the owner", async () => {
      const { testApp, request, mockUpdateReferralNotifications } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, enabled: false });
      expect(mockUpdateReferralNotifications).toHaveBeenCalledWith(
        "test-member-id",
        false,
      );
    });

    it("turns Referral Notifications back on", async () => {
      const { testApp, request } = setup({ body: { enabled: true } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, enabled: true });
    });
  });

  describe("Input validation", () => {
    it("rejects a missing enabled field", async () => {
      const { testApp, request, mockUpdateReferralNotifications } = setup({
        body: {},
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
      expect(mockUpdateReferralNotifications).not.toHaveBeenCalled();
    });

    it("rejects a non-boolean enabled value", async () => {
      const { testApp, request } = setup({ body: { enabled: "no" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Errors", () => {
    it("returns 404 when the member document does not exist", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    it("returns 500 and logs on unexpected failures", async () => {
      const { testApp, request, logger } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Failed to update referral email preference",
      });
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update Referral Notification preference",
        expect.objectContaining({
          errorId: ERROR_IDS.UPDATE_REFERRAL_NOTIFICATIONS_ROUTE_FAILED,
        }),
      );
    });
  });
});
