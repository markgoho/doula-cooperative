import { describe, expect, it } from "bun:test";
import { StripeConfigurationError } from "../../errors/stripe-errors.js";

// Import function directly
const { verifySignature } = await import("./verify-signature.js");

/**
 * Tests for verifySignature input validation (no Stripe SDK mocking).
 *
 * These tests verify input validation logic without mocking Stripe internals.
 * Actual signature verification tests with valid Stripe events would require
 * mocking at the service interface level in route tests.
 */
describe("verifySignature", () => {
  describe("Input Validation", () => {
    it("should throw StripeConfigurationError when STRIPE_WEBHOOK_SECRET is not set", () => {
      const originalSecret = process.env["STRIPE_WEBHOOK_SECRET"];
      const originalApiKey = process.env["STRIPE_API_KEY"];

      delete process.env["STRIPE_WEBHOOK_SECRET"];
      process.env["STRIPE_API_KEY"] = "test_key";

      expect(() =>
        verifySignature({
          rawBody: Buffer.from("test"),
          signature: "test_sig",
        }),
      ).toThrow(StripeConfigurationError);

      expect(() =>
        verifySignature({
          rawBody: Buffer.from("test"),
          signature: "test_sig",
        }),
      ).toThrow("Stripe integration not configured");

      // Restore
      if (originalSecret) {
        process.env["STRIPE_WEBHOOK_SECRET"] = originalSecret;
      }
      if (originalApiKey) {
        process.env["STRIPE_API_KEY"] = originalApiKey;
      } else {
        delete process.env["STRIPE_API_KEY"];
      }
    });

    it("should throw StripeConfigurationError when STRIPE_API_KEY is not set", () => {
      const originalSecret = process.env["STRIPE_WEBHOOK_SECRET"];
      const originalApiKey = process.env["STRIPE_API_KEY"];

      process.env["STRIPE_WEBHOOK_SECRET"] = "test_secret";
      delete process.env["STRIPE_API_KEY"];

      expect(() =>
        verifySignature({
          rawBody: Buffer.from("test"),
          signature: "test_sig",
        }),
      ).toThrow(StripeConfigurationError);

      expect(() =>
        verifySignature({
          rawBody: Buffer.from("test"),
          signature: "test_sig",
        }),
      ).toThrow("Stripe integration not configured");

      // Restore
      if (originalSecret) {
        process.env["STRIPE_WEBHOOK_SECRET"] = originalSecret;
      } else {
        delete process.env["STRIPE_WEBHOOK_SECRET"];
      }
      if (originalApiKey) {
        process.env["STRIPE_API_KEY"] = originalApiKey;
      }
    });

    it("should throw StripeConfigurationError when both secrets are missing", () => {
      const originalSecret = process.env["STRIPE_WEBHOOK_SECRET"];
      const originalApiKey = process.env["STRIPE_API_KEY"];

      delete process.env["STRIPE_WEBHOOK_SECRET"];
      delete process.env["STRIPE_API_KEY"];

      expect(() =>
        verifySignature({
          rawBody: Buffer.from("test"),
          signature: "test_sig",
        }),
      ).toThrow(StripeConfigurationError);

      expect(() =>
        verifySignature({
          rawBody: Buffer.from("test"),
          signature: "test_sig",
        }),
      ).toThrow("Stripe integration not configured");

      // Restore
      if (originalSecret) {
        process.env["STRIPE_WEBHOOK_SECRET"] = originalSecret;
      }
      if (originalApiKey) {
        process.env["STRIPE_API_KEY"] = originalApiKey;
      }
    });
  });

  describe("Signature Verification", () => {
    it.skip("Signature verification tests require valid Stripe SDK setup", () => {
      // These tests would need to actually call stripe.webhooks.constructEvent()
      // which requires a valid webhook secret and properly signed payload.
      //
      // Instead, signature verification is tested at the route level by mocking
      // the StripeWebhookService interface.
      //
      // See routes/stripe-webhook/handle-webhook.test.ts for examples of mocking
      // verifySignature at the service interface level.
    });
  });
});
