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

    const testApp = createStripeWebhookTestPlugin({
      stripeWebhookService: {
        verifySignature: mockVerifySignature,
        markEventProcessed: mockMarkEventProcessed,
        processCheckoutCompleted: mockProcessCheckout,
        processChargeRefunded: mockProcessChargeRefunded,
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
        eventType: "customer.subscription.updated",
        sessionData: {
          id: "sub_123",
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
  });
});
