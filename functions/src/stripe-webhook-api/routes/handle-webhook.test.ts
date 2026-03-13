import { describe, expect, it, mock } from "bun:test";
import type Stripe from "stripe";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import {
  StripeConfigurationError,
  StripeSignatureError,
} from "../../shared-api/errors/stripe-errors.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { ChargeRefundedResult } from "../services/process-charge-refunded.js";
import type { SubscriptionEndedResult } from "../services/process-subscription-ended.js";
import type { SubscriptionUpdatedResult } from "../services/process-subscription-updated.js";
import { createStripeWebhookTestPlugin } from "../test-utils/create-stripe-webhook-test-plugin.js";
import { createMockStripeEvent } from "../test-utils/stripe-mocks.js";

/**
 * Tests for POST /webhook.
 *
 * Uses createStripeWebhookTestPlugin() factory with mocked services.
 */
describe("POST /webhook", () => {
  interface SetupOptions {
    body?: Record<string, unknown>;
    stripeSignature?: string | null;
    signatureInvalid?: boolean;
    configurationError?: boolean;
    unexpectedSignatureError?: boolean;
    eventAlreadyProcessed?: boolean;
    eventType?: string;
    sessionData?: Record<string, unknown>;
    processCheckoutResult?: {
      userId: string;
      isNewUser: boolean;
      emailSent: boolean;
      mailerliteSynced: boolean;
      warning?: string;
    };
    processCheckoutError?: Error;
    processChargeRefundedResult?: ChargeRefundedResult;
    processChargeRefundedError?: Error;
    processSubscriptionEndedResult?: SubscriptionEndedResult;
    processSubscriptionEndedError?: Error;
    processSubscriptionUpdatedResult?: SubscriptionUpdatedResult;
    processSubscriptionUpdatedError?: Error;
  }

  function setup({
    body = { test: true },
    stripeSignature = "valid_sig",
    signatureInvalid = false,
    configurationError = false,
    unexpectedSignatureError = false,
    eventAlreadyProcessed = false,
    eventType = "checkout.session.completed",
    sessionData = {
      id: "cs_test_123",
      customer_details: { email: "newuser@example.com" },
      metadata: { name: "New User" },
    },
    processCheckoutResult = {
      userId: "new-user-123",
      isNewUser: true,
      emailSent: true,
      mailerliteSynced: true,
    },
    processCheckoutError,
    processChargeRefundedResult = {
      memberId: "test-member-123",
      memberFound: true,
      subscriptionCanceled: true,
      refundActions: {
        memberDeactivated: true,
      },
    },
    processChargeRefundedError,
    processSubscriptionEndedResult = {
      memberId: "test-member-123",
      memberFound: true,
      memberDeactivated: true,
    },
    processSubscriptionEndedError,
    processSubscriptionUpdatedResult = {
      memberId: "test-member-123",
      memberFound: true,
      statusUpdated: true,
      newStatus: "active" as const,
    },
    processSubscriptionUpdatedError,
  }: SetupOptions = {}) {
    const mockVerifySignature = mock((): Stripe.Event => {
      if (signatureInvalid) {
        throw new StripeSignatureError("Invalid signature");
      }
      if (configurationError) {
        throw new StripeConfigurationError("STRIPE_WEBHOOK_SECRET not set");
      }
      if (unexpectedSignatureError) {
        throw new Error("Unexpected error");
      }
      return createMockStripeEvent(eventType, sessionData);
    });

    const mockMarkEventProcessed = mock(() =>
      Promise.resolve(!eventAlreadyProcessed),
    );

    const mockProcessCheckout = mock(() => {
      if (processCheckoutError) {
        return Promise.reject(processCheckoutError);
      }
      return Promise.resolve(processCheckoutResult);
    });

    const mockProcessChargeRefunded = mock(() => {
      if (processChargeRefundedError) {
        return Promise.reject(processChargeRefundedError);
      }
      return Promise.resolve(processChargeRefundedResult);
    });

    const mockProcessSubscriptionEnded = mock(() => {
      if (processSubscriptionEndedError) {
        return Promise.reject(processSubscriptionEndedError);
      }
      return Promise.resolve(processSubscriptionEndedResult);
    });

    const mockProcessSubscriptionUpdated = mock(() => {
      if (processSubscriptionUpdatedError) {
        return Promise.reject(processSubscriptionUpdatedError);
      }
      return Promise.resolve(processSubscriptionUpdatedResult);
    });

    const testApp = createStripeWebhookTestPlugin({
      stripeWebhookService: {
        verifySignature: mockVerifySignature,
        markEventProcessed: mockMarkEventProcessed,
        processCheckoutCompleted: mockProcessCheckout,
        processChargeRefunded: mockProcessChargeRefunded,
        processSubscriptionEnded: mockProcessSubscriptionEnded,
        processSubscriptionUpdated: mockProcessSubscriptionUpdated,
      },
    });

    const headers: Record<string, string> = {};
    if (stripeSignature) {
      headers["stripe-signature"] = stripeSignature;
    }

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request };
  }

  describe("Signature validation", () => {
    it("should return 400 when stripe-signature header is missing", async () => {
      const { testApp, request } = setup({ stripeSignature: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Missing signature");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_SIGNATURE);
    });

    it("should return 400 when signature is invalid", async () => {
      const { testApp, request } = setup({
        stripeSignature: "invalid_sig",
        signatureInvalid: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Invalid signature");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_INVALID_SIGNATURE);
    });

    it("should return 500 when Stripe is not configured", async () => {
      const { testApp, request } = setup({ configurationError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("STRIPE_WEBHOOK_SECRET not set");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_CONFIG);
    });

    it("should return 500 for unexpected signature verification errors", async () => {
      const { testApp, request } = setup({
        unexpectedSignatureError: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Internal server error");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR);
    });
  });

  describe("Idempotency", () => {
    it("should return duplicate:true when event was already processed", async () => {
      const { testApp, request } = setup({ eventAlreadyProcessed: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        duplicate?: boolean;
      };
      expect(body.received).toBe(true);
      expect(body.duplicate).toBe(true);
    });
  });

  describe("Checkout session processing", () => {
    it("should successfully process a new user checkout", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
        isNewUser?: boolean;
        emailSent?: boolean;
        mailerliteSynced?: boolean;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("new-user-123");
      expect(body.isNewUser).toBe(true);
      expect(body.emailSent).toBe(true);
      expect(body.mailerliteSynced).toBe(true);
    });

    it("should successfully process an existing user checkout", async () => {
      const { testApp, request } = setup({
        processCheckoutResult: {
          userId: "existing-user-456",
          isNewUser: false,
          emailSent: true,
          mailerliteSynced: true,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
        isNewUser?: boolean;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("existing-user-456");
      expect(body.isNewUser).toBe(false);
    });

    it("should include warning when non-critical services fail", async () => {
      const { testApp, request } = setup({
        processCheckoutResult: {
          userId: "user-789",
          isNewUser: true,
          emailSent: false,
          mailerliteSynced: false,
          warning: "Newsletter and email services unavailable",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        emailSent?: boolean;
        mailerliteSynced?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.emailSent).toBe(false);
      expect(body.mailerliteSynced).toBe(false);
      expect(body.warning).toBe("Newsletter and email services unavailable");
    });

    it("should return success for checkout when no exact imported member match exists", async () => {
      const { testApp, request } = setup({
        sessionData: {
          id: "cs_test_unmatched",
          customer_details: { email: "nomatch@example.com" },
          metadata: { name: "No Match" },
        },
        processCheckoutResult: {
          userId: "paid-member-001",
          isNewUser: true,
          emailSent: true,
          mailerliteSynced: true,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
        isNewUser?: boolean;
        emailSent?: boolean;
        mailerliteSynced?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("paid-member-001");
      expect(body.isNewUser).toBe(true);
      expect(body.emailSent).toBe(true);
      expect(body.mailerliteSynced).toBe(true);
      expect(body.warning).toBeUndefined();
    });

    it("should return success for checkout when exact imported member match is auto-linked", async () => {
      const { testApp, request } = setup({
        sessionData: {
          id: "cs_test_autolink",
          customer_details: { email: "legacy-match@example.com" },
          metadata: { name: "Legacy Match" },
        },
        processCheckoutResult: {
          userId: "paid-member-legacy-123",
          isNewUser: true,
          emailSent: true,
          mailerliteSynced: true,
          warning: "Imported legacy profile auto-linked during checkout",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
        isNewUser?: boolean;
        emailSent?: boolean;
        mailerliteSynced?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("paid-member-legacy-123");
      expect(body.isNewUser).toBe(true);
      expect(body.emailSent).toBe(true);
      expect(body.mailerliteSynced).toBe(true);
      expect(body.warning).toBe("Imported legacy profile auto-linked during checkout");
    });

    it("should return success with warning when exact imported match cannot be merged", async () => {
      const { testApp, request } = setup({
        sessionData: {
          id: "cs_test_invalid_import",
          customer_details: { email: "legacy-invalid@example.com" },
          metadata: { name: "Legacy Invalid" },
        },
        processCheckoutResult: {
          userId: "paid-member-invalid-456",
          isNewUser: true,
          emailSent: true,
          mailerliteSynced: true,
          warning:
            "Imported member record matched checkout email but requires manual admin attachment.",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("paid-member-invalid-456");
      expect(body.warning).toBe(
        "Imported member record matched checkout email but requires manual admin attachment.",
      );
    });

    it("should return duplicate true when a retried checkout event was already processed", async () => {
      const { testApp, request } = setup({
        eventType: "checkout.session.completed",
        eventAlreadyProcessed: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        duplicate?: boolean;
      };
      expect(body.received).toBe(true);
      expect(body.duplicate).toBe(true);
    });

    it("should return error when checkout processing throws HttpError", async () => {
      const { testApp, request } = setup({
        processCheckoutError: new HttpError("Duplicate email address", 409),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Duplicate email address");
    });

    it("should return 500 for unexpected processing errors", async () => {
      const { testApp, request } = setup({
        processCheckoutError: new Error("Database connection failed"),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Internal server error");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR);
    });
  });

  describe("Unhandled event types", () => {
    it("should acknowledge unhandled event types with received:true", async () => {
      const { testApp, request } = setup({
        eventType: "payment_intent.succeeded",
        sessionData: {
          id: "pi_123",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { received?: boolean };
      expect(body.received).toBe(true);
    });
  });

  describe("charge.refunded", () => {
    it("should successfully process a refund", async () => {
      const { testApp, request } = setup({
        eventType: "charge.refunded",
        sessionData: {
          id: "ch_test_456",
          customer: "cus_test_789",
        },
        processChargeRefundedResult: {
          memberId: "refunded-member-123",
          memberFound: true,
          subscriptionCanceled: true,
          refundActions: {
            memberDeactivated: true,
          },
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("refunded-member-123");
    });

    it("should handle refund when member is not found", async () => {
      const { testApp, request } = setup({
        eventType: "charge.refunded",
        sessionData: {
          id: "ch_test_456",
          customer: "cus_unknown",
        },
        processChargeRefundedResult: {
          memberFound: false,
          subscriptionCanceled: false,
          refundActions: {
            memberDeactivated: false,
          },
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { received?: boolean };
      expect(body.received).toBe(true);
    });

    it("should return duplicate:true when refund event already processed", async () => {
      const { testApp, request } = setup({
        eventType: "charge.refunded",
        sessionData: {
          id: "ch_test_456",
          customer: "cus_test_789",
        },
        eventAlreadyProcessed: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        duplicate?: boolean;
      };
      expect(body.received).toBe(true);
      expect(body.duplicate).toBe(true);
    });

    it("should handle missing customer ID on charge", async () => {
      const { testApp, request } = setup({
        eventType: "charge.refunded",
        sessionData: {
          id: "ch_test_456",
          // No customer field
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.warning).toBe("No customer ID on charge");
    });

    it("should include warning when non-critical refund actions fail", async () => {
      const { testApp, request } = setup({
        eventType: "charge.refunded",
        sessionData: {
          id: "ch_test_456",
          customer: "cus_test_789",
        },
        processChargeRefundedResult: {
          memberId: "refunded-member-123",
          memberFound: true,
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
      const body = (await response.json()) as {
        received?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.warning).toContain("Non-critical actions failed");
    });

    it("should return 500 for unexpected refund processing errors", async () => {
      const { testApp, request } = setup({
        eventType: "charge.refunded",
        sessionData: {
          id: "ch_test_456",
          customer: "cus_test_789",
        },
        processChargeRefundedError: new Error("Database connection failed"),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Internal server error");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR);
    });

    it("should return HttpError status when refund processing throws HttpError", async () => {
      const { testApp, request } = setup({
        eventType: "charge.refunded",
        sessionData: {
          id: "ch_test_456",
          customer: "cus_test_789",
        },
        processChargeRefundedError: new HttpError("Duplicate refund", 409),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Duplicate refund");
    });
  });

  describe("customer.subscription.deleted", () => {
    it("should successfully process subscription end", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.deleted",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
          status: "canceled",
        },
        processSubscriptionEndedResult: {
          memberId: "ended-member-123",
          memberFound: true,
          memberDeactivated: true,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("ended-member-123");
    });

    it("should return duplicate:true when subscription end event already processed", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.deleted",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
        },
        eventAlreadyProcessed: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        duplicate?: boolean;
      };
      expect(body.received).toBe(true);
      expect(body.duplicate).toBe(true);
    });

    it("should handle missing customer ID on subscription", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.deleted",
        sessionData: {
          id: "sub_test_123",
          // No customer field
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.warning).toBe("No customer ID on subscription");
    });

    it("should include warning when non-critical actions fail", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.deleted",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
        },
        processSubscriptionEndedResult: {
          memberId: "ended-member-123",
          memberFound: true,
          memberDeactivated: true,
          profileDrafted: false,
          warning: "Non-critical actions failed: Draft profile failed",
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.warning).toContain("Non-critical actions failed");
    });

    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.deleted",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
        },
        processSubscriptionEndedError: new Error("Database connection failed"),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Internal server error");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR);
    });

    it("should return HttpError status when processing throws HttpError", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.deleted",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
        },
        processSubscriptionEndedError: new HttpError("Member not found", 404),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });

  describe("customer.subscription.updated", () => {
    it("should successfully process subscription status update", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.updated",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
          status: "active",
        },
        processSubscriptionUpdatedResult: {
          memberId: "updated-member-123",
          memberFound: true,
          statusUpdated: true,
          newStatus: "active" as const,
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        userId?: string;
      };
      expect(body.received).toBe(true);
      expect(body.userId).toBe("updated-member-123");
    });

    it("should return duplicate:true when subscription update event already processed", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.updated",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
          status: "past_due",
        },
        eventAlreadyProcessed: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        duplicate?: boolean;
      };
      expect(body.received).toBe(true);
      expect(body.duplicate).toBe(true);
    });

    it("should handle missing customer ID on subscription", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.updated",
        sessionData: {
          id: "sub_test_123",
          status: "active",
          // No customer field
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.warning).toBe("No customer ID on subscription");
    });

    it("should handle missing status on subscription", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.updated",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
          // No status field
        },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        received?: boolean;
        warning?: string;
      };
      expect(body.received).toBe(true);
      expect(body.warning).toBe("No status on subscription");
    });

    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.updated",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
          status: "active",
        },
        processSubscriptionUpdatedError: new Error(
          "Database connection failed",
        ),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Internal server error");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR);
    });

    it("should return HttpError status when processing throws HttpError", async () => {
      const { testApp, request } = setup({
        eventType: "customer.subscription.updated",
        sessionData: {
          id: "sub_test_123",
          customer: "cus_test_789",
          status: "active",
        },
        processSubscriptionUpdatedError: new HttpError("Member not found", 404),
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });
});
