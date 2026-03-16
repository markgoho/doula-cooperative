import {
  NotFoundError,
  ValidationError,
} from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { handleRequest } from "@doula-coop/functions-shared/test-utils/handle-request.js";
import type { MemberDocument } from "@doula-coop/functions-shared/types/member-document.js";
import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { RefundMembershipResult } from "../services/refund-membership.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/membership/refund.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/membership/refund", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;
    body?: Record<string, unknown>;

    // Scenario flags
    memberNotFound?: boolean;
    noStripeData?: boolean;
    stripeApiError?: boolean;
    refundWindowExpired?: boolean;
    refundResult?: RefundMembershipResult;
  }

  function setup({
    memberId = "test-id",
    authToken = "admin-token",
    body = {},
    memberNotFound = false,
    noStripeData = false,
    stripeApiError = false,
    refundWindowExpired = false,
    refundResult,
  }: SetupOptions = {}) {
    const defaultMember: MemberDocument = {
      uid: "test-id",
      email: "test@example.com",
      createdAt: Timestamp.now(),
      membershipActive: false,
      subscriptionStatus: "refunded",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      refundedAt: Timestamp.now(),
    };

    const defaultResult: RefundMembershipResult = {
      member: defaultMember,
      stripeRefundCreated: true,
      subscriptionCanceled: true,
      refundActions: {
        memberDeactivated: true,
      },
    };

    const mockRefundMembership = mock((): Promise<RefundMembershipResult> => {
      if (memberNotFound) {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      if (noStripeData) {
        return Promise.reject(
          new ValidationError(
            "Member does not have Stripe subscription data. Use manual deactivation instead.",
          ),
        );
      }
      if (refundWindowExpired) {
        return Promise.reject(
          new ValidationError(
            "Refunds are only available within 30 days of the subscription start date.",
          ),
        );
      }
      if (stripeApiError) {
        return Promise.reject(new Error("Stripe API error"));
      }
      return Promise.resolve(refundResult ?? defaultResult);
    });

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        refundMembership: mockRefundMembership,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/membership/refund`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
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

    it("should return 403 when non-admin tries to refund", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });
  });

  describe("Successful refund", () => {
    it("should refund membership successfully", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as {
        success?: boolean;
        refundResult?: {
          stripeRefundCreated?: boolean;
          subscriptionCanceled?: boolean;
          memberDeactivated?: boolean;
        };
      };
      expect(responseBody.success).toBe(true);
      expect(responseBody.refundResult?.stripeRefundCreated).toBe(true);
      expect(responseBody.refundResult?.subscriptionCanceled).toBe(true);
      expect(responseBody.refundResult?.memberDeactivated).toBe(true);
    });

    it("should accept optional reason in body", async () => {
      const { testApp, request } = setup({
        body: { reason: "Customer requested refund" },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });

    it("should include warning when non-critical actions fail", async () => {
      const { testApp, request } = setup({
        refundResult: {
          member: {
            uid: "test-id",
            email: "test@example.com",
            createdAt: Timestamp.now(),
            membershipActive: false,
            subscriptionStatus: "refunded",
            refundedAt: Timestamp.now(),
          },
          stripeRefundCreated: true,
          subscriptionCanceled: true,
          refundActions: {
            memberDeactivated: true,
            profileDrafted: false,
            warning: "Non-critical actions failed: Draft profile failed",
          },
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as {
        success?: boolean;
        refundResult?: { warning?: string };
      };
      expect(responseBody.success).toBe(true);
      expect(responseBody.refundResult?.warning).toContain(
        "Non-critical actions failed",
      );
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent member", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    it("should return 400 when member has no Stripe data", async () => {
      const { testApp, request } = setup({ noStripeData: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const responseBody = (await response.json()) as { error?: string };
      expect(responseBody.error).toContain("Stripe subscription data");
    });

    it("should return 400 when refund window has expired", async () => {
      const { testApp, request } = setup({ refundWindowExpired: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const responseBody = (await response.json()) as { error?: string };
      expect(responseBody.error).toContain("30 days");
    });

    it("should return 500 for Stripe API errors", async () => {
      const { testApp, request } = setup({ stripeApiError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
    });
  });
});
