import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for POST /:memberId/membership/cancel.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("POST /:memberId/membership/cancel", () => {
  interface SetupOptions {
    // Request parameters
    memberId?: string;
    authToken?: string | null;

    // Scenario flags
    memberNotFound?: boolean;
    hasStripeData?: boolean;
    stripeCancelFails?: boolean;
  }

  function setup({
    memberId = "test-id",
    authToken = "admin-token",
    memberNotFound = false,
    hasStripeData = false,
    stripeCancelFails = false,
  }: SetupOptions = {}) {
    // Configure mock based on scenario
    const mockCancelMembership = mock(
      (id: string): Promise<MemberDocument> => {
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        if (stripeCancelFails) {
          return Promise.reject(new Error("Stripe API error"));
        }
        if (hasStripeData) {
          return Promise.resolve({
            uid: id,
            email: "test@example.com",
            createdAt: Timestamp.now(),
            membershipActive: true,
            stripeCustomerId: "cus_123",
            stripeSubscriptionId: "sub_456",
            subscriptionStatus: "canceled",
          });
        }
        return Promise.resolve({
          uid: id,
          email: "test@example.com",
          createdAt: Timestamp.now(),
          membershipActive: false,
        });
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        cancelMembership: mockCancelMembership,
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

    it("should return 403 when non-admin tries to cancel", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });
  });

  describe("Successful cancellation (legacy member without Stripe)", () => {
    it("should cancel membership successfully for legacy member", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { membershipActive?: boolean };
      };
      expect(body.success).toBe(true);
      expect(body.member?.membershipActive).toBe(false);
    });
  });

  describe("Successful cancellation (Stripe member)", () => {
    it("should cancel membership with Stripe subscription at period end", async () => {
      const { testApp, request } = setup({ hasStripeData: true });

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
    it("should return 404 for non-existent member", async () => {
      const { testApp, request } = setup({ memberId: "non-existent-id" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });

    it("should return 500 when Stripe cancellation fails", async () => {
      const { testApp, request } = setup({
        hasStripeData: true,
        stripeCancelFails: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
    });
  });
});
