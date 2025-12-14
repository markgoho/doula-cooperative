import { describe, expect, it, beforeEach, mock } from "bun:test";
import type Stripe from "stripe";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import {
  StripeConfigurationError,
  StripeSignatureError,
} from "../../../shared-api/errors/stripe-errors.js";
import { HttpError } from "../../../shared-api/errors/http-error.js";
import { createStripeWebhookTestPlugin } from "../../test-utils/create-stripe-webhook-test-plugin.js";
import { createMockStripeEvent } from "../../test-utils/stripe-mocks.js";

/**
 * Tests for POST /stripe/webhook.
 *
 * Uses createStripeWebhookTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /stripe/webhook", () => {
  describe("Signature validation", () => {
    it("should return 400 when stripe-signature header is missing", async () => {
      const testApp = createStripeWebhookTestPlugin();

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Missing signature");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_SIGNATURE);
    });

    it("should return 400 when signature is invalid", async () => {
      const mockVerifySignature = mock(() => {
        throw new StripeSignatureError("Invalid signature");
      });

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "invalid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("Invalid signature");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_INVALID_SIGNATURE);
    });

    it("should return 500 when Stripe is not configured", async () => {
      const mockVerifySignature = mock(() => {
        throw new StripeConfigurationError("STRIPE_WEBHOOK_SECRET not set");
      });

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "test_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as {
        error?: string;
        errorId?: string;
      };
      expect(body.error).toBe("STRIPE_WEBHOOK_SECRET not set");
      expect(body.errorId).toBe(ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_CONFIG);
    });

    it("should return 500 for unexpected signature verification errors", async () => {
      const mockVerifySignature = mock(() => {
        throw new Error("Unexpected error");
      });

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "test_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

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
      const mockMarkEventProcessed = mock(() => Promise.resolve(false));

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          markEventProcessed: mockMarkEventProcessed,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

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
    const mockVerifySignature = mock(() =>
      createMockStripeEvent("checkout.session.completed", {
        id: "cs_test_123",
        customer_details: { email: "newuser@example.com" },
        metadata: { name: "New User" },
      }),
    );

    const mockMarkEventProcessed = mock(() => Promise.resolve(true));

    beforeEach(() => {
      mockVerifySignature.mockClear();
      mockMarkEventProcessed.mockClear();
    });

    it("should successfully process a new user checkout", async () => {
      const mockProcessCheckout = mock(() =>
        Promise.resolve({
          userId: "new-user-123",
          isNewUser: true,
          emailSent: true,
          mailerliteSynced: true,
        }),
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
          markEventProcessed: mockMarkEventProcessed,
          processCheckoutCompleted: mockProcessCheckout,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

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
      const mockProcessCheckout = mock(() =>
        Promise.resolve({
          userId: "existing-user-456",
          isNewUser: false,
          emailSent: true,
          mailerliteSynced: true,
        }),
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
          markEventProcessed: mockMarkEventProcessed,
          processCheckoutCompleted: mockProcessCheckout,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

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
      const mockProcessCheckout = mock(() =>
        Promise.resolve({
          userId: "user-789",
          isNewUser: true,
          emailSent: false,
          mailerliteSynced: false,
          warning: "Newsletter and email services unavailable",
        }),
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
          markEventProcessed: mockMarkEventProcessed,
          processCheckoutCompleted: mockProcessCheckout,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

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
      const mockProcessCheckout = mock(() =>
        Promise.reject(new HttpError("Duplicate email address", 409)),
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
          markEventProcessed: mockMarkEventProcessed,
          processCheckoutCompleted: mockProcessCheckout,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Duplicate email address");
    });

    it("should return 500 for unexpected processing errors", async () => {
      const mockProcessCheckout = mock(() =>
        Promise.reject(new Error("Database connection failed")),
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
          markEventProcessed: mockMarkEventProcessed,
          processCheckoutCompleted: mockProcessCheckout,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

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
      const mockVerifySignature = mock(() =>
        createMockStripeEvent("customer.subscription.updated", {
          id: "sub_123",
        }),
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { received?: boolean };
      expect(body.received).toBe(true);
    });
  });

  describe("Service interaction", () => {
    it("should call verifySignature with raw body and signature", async () => {
      const mockVerifySignature = mock(
        (options: { rawBody: Buffer; signature: string }) => {
          // Verify the parameters are correctly passed
          expect(options.signature).toBe("test_signature_value");
          expect(Buffer.isBuffer(options.rawBody)).toBe(true);
          return createMockStripeEvent("checkout.session.completed", {});
        },
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mockVerifySignature,
        },
      });

      await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "test_signature_value",
          },
          body: JSON.stringify({ test: true }),
        }),
      );

      expect(mockVerifySignature).toHaveBeenCalledTimes(1);
    });

    it("should call markEventProcessed with event ID and type", async () => {
      const mockMarkEventProcessed = mock(
        (options: { eventId: string; eventType: string }) => {
          expect(options.eventId).toBe("evt_test_123");
          expect(options.eventType).toBe("checkout.session.completed");
          return Promise.resolve(true);
        },
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          markEventProcessed: mockMarkEventProcessed,
        },
      });

      await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      );

      expect(mockMarkEventProcessed).toHaveBeenCalledTimes(1);
    });

    it("should call processCheckoutCompleted with session data", async () => {
      const mockProcessCheckout = mock(
        (options: { session: Stripe.Checkout.Session }) => {
          expect(options.session.id).toBe("cs_test_123");
          return Promise.resolve({
            userId: "user-123",
            isNewUser: true,
            emailSent: true,
            mailerliteSynced: true,
          });
        },
      );

      const testApp = createStripeWebhookTestPlugin({
        stripeWebhookService: {
          verifySignature: mock(() =>
            createMockStripeEvent("checkout.session.completed", {
              id: "cs_test_123",
            }),
          ),
          processCheckoutCompleted: mockProcessCheckout,
        },
      });

      await testApp.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "stripe-signature": "valid_sig",
          },
          body: JSON.stringify({ test: true }),
        }),
      );

      expect(mockProcessCheckout).toHaveBeenCalledTimes(1);
    });
  });
});
