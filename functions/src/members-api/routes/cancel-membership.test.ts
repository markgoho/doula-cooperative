import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

/**
 * Tests for POST /:memberId/membership/cancel (member self-service).
 *
 * Uses createMembersTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/membership/cancel", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    noStripeData?: boolean;
    stripeCancelFails?: boolean;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    memberNotFound = false,
    noStripeData = false,
    stripeCancelFails = false,
  }: SetupOptions = {}) {
    const mockCancelMembership = mock((id: string): Promise<MemberDocument> => {
      if (memberNotFound) {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      if (noStripeData) {
        return Promise.reject(
          new ValidationError(
            "Cannot cancel membership: no Stripe subscription data found. Please contact support.",
          ),
        );
      }
      if (stripeCancelFails) {
        return Promise.reject(new Error("Stripe API error"));
      }
      return Promise.resolve({
        uid: id,
        email: "test@example.com",
        createdAt: Timestamp.now(),
        membershipActive: true,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_456",
        subscriptionStatus: "canceled",
      });
    });

    const testApp = createMembersTestPlugin({
      memberService: {
        cancelMembership: mockCancelMembership,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/membership/cancel`,
      {
        method: "POST",
        headers,
      },
    );

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-owner/non-admin tries to cancel", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });
  });

  describe("Successful cancellation", () => {
    it("should cancel membership and return updated member", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: {
          membershipActive?: boolean;
          subscriptionStatus?: string;
        };
      };
      expect(body.success).toBe(true);
      expect(body.member?.membershipActive).toBe(true);
      expect(body.member?.subscriptionStatus).toBe("canceled");
    });
  });

  describe("Error handling", () => {
    it("should return 400 when member has no Stripe data", async () => {
      const { testApp, request } = setup({ noStripeData: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
    });

    it("should return 500 when Stripe cancellation fails", async () => {
      const { testApp, request } = setup({ stripeCancelFails: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
    });
  });
});
