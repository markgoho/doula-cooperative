import { describe, expect, it, mock } from "bun:test";
import type { Request as FirebaseRequest } from "firebase-functions/v2/https";
import type { FirebaseResponse } from "../shared-api/types/firebase-response.js";
import type { Logger } from "../shared-api/types/logger.js";
import { createMockStripeEvent } from "./test-utils/stripe-mocks.js";

/**
 * Integration tests for the stripe-webhook-api handler.
 * Tests the full Firebase → toWebRequest → Elysia (with node adapter) path.
 * Unit tests in routes/handle-webhook.test.ts test the plugin in isolation
 * without the node adapter, so they miss body-consumption bugs.
 */

function createMockLogger(): Logger {
  return {
    info: mock(),
    warn: mock(),
    error: mock(),
  };
}

function createMockFirebaseResponse() {
  const sentData: {
    status?: number;
    body?: unknown;
    headers: Record<string, string>;
  } = {
    headers: {},
  };

  const result = {
    headersSent: false,
    status: mock((code: number) => {
      sentData.status = code;
      return result;
    }),
    json: mock((body: unknown) => {
      sentData.body = body;
    }),
    send: mock((body: unknown) => {
      sentData.body = body;
    }),
    setHeader: mock((key: string, value: string) => {
      sentData.headers[key] = value;
    }),
  } as unknown as FirebaseResponse;

  return { response: result, sentData };
}

function createMockFirebaseRequest(options: {
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}): FirebaseRequest {
  const bodyString = JSON.stringify(options.body);
  const rawBody = Buffer.from(bodyString);

  return {
    url: "/api/stripe/webhook",
    method: "POST",
    headers: {
      host: "localhost",
      "content-type": "application/json",
      ...options.headers,
    },
    rawBody,
  } as unknown as FirebaseRequest;
}

describe("handleStripeWebhookApi", () => {
  describe("POST /api/stripe/webhook (full integration)", () => {
    it("should pass raw body to Stripe signature verification without 'Body already read' error", async () => {
      const webhookBody = {
        id: "evt_test",
        type: "checkout.session.completed",
      };
      const mockLogger = createMockLogger();

      const mockVerifySignature = mock(() =>
        createMockStripeEvent("checkout.session.completed", {
          id: "cs_test_123",
          customer_details: { email: "test@example.com" },
        }),
      );
      const mockMarkEventProcessed = mock(() => Promise.resolve(true));
      const mockProcessCheckout = mock(() =>
        Promise.resolve({
          userId: "test-user-123",
          isNewUser: true,
          emailSent: true,
          mailerliteSynced: true,
        }),
      );

      const request = createMockFirebaseRequest({
        body: webhookBody,
        headers: { "stripe-signature": "test_sig_123" },
      });

      const rawBody = (request as FirebaseRequest & { rawBody: Buffer })
        .rawBody;

      const { createApp } = await import("./app.js");
      const app = createApp({
        services: {
          stripeWebhookService: {
            verifySignature: mockVerifySignature,
            isEventProcessed: mock(() => Promise.resolve(false)),
            markEventProcessed: mockMarkEventProcessed,
            processCheckoutCompleted: mockProcessCheckout,
          },
          logger: mockLogger,
        },
        rawBody,
      });

      const { toWebRequest } = await import("../shared-api/adapters.js");
      const webRequest = toWebRequest(request);
      const webResponse = await app.handle(webRequest);
      const responseText = await webResponse.text();

      expect(responseText).not.toContain("Body");
      expect(responseText).not.toContain("already been read");

      const responseBody = JSON.parse(responseText) as Record<string, unknown>;

      expect(mockVerifySignature).toHaveBeenCalledTimes(1);

      const verifyArguments = mockVerifySignature.mock.calls[0] as unknown as [
        { rawBody: Buffer; signature: string },
      ];
      expect(verifyArguments[0].rawBody).toBeInstanceOf(Buffer);
      expect(verifyArguments[0].rawBody.length).toBeGreaterThan(0);

      expect(webResponse.status).toBe(200);
      expect(responseBody["received"]).toBe(true);
      expect(responseBody["userId"]).toBe("test-user-123");
    });

    it("should handle health check through full handler path", async () => {
      const mockLogger = createMockLogger();
      const { response } = createMockFirebaseResponse();

      const request = {
        url: "/api/stripe/health",
        method: "GET",
        headers: { host: "localhost" },
      } as unknown as FirebaseRequest;

      const { handleStripeWebhookApi } = await import("./handler.js");
      await handleStripeWebhookApi(request, response, mockLogger);

      expect(
        (mockLogger.error as ReturnType<typeof mock>).mock.calls,
      ).toHaveLength(0);
    });
  });
});
