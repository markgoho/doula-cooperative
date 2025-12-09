import { describe, expect, test } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { addNewsletterSubscriber } from "../src/utils/mailerlite.js";

describe("addNewsletterSubscriber", () => {
  const mockEmail = "test@example.com";
  const mockApiKey = "invalid-test-api-key"; // Invalid key to trigger errors
  const mockSubscriptionStart = Timestamp.fromDate(
    new Date("2025-01-01T00:00:00Z"),
  );
  const mockMembershipExpires = Timestamp.fromDate(
    new Date("2026-01-01T00:00:00Z"),
  );

  // Note: These tests verify error handling by using an invalid API key
  // which will cause the MailerLite SDK to throw errors. This approach
  // tests the real error classification logic without complex mocking.

  test("should throw error with proper message format on authentication failure", () => {
    // Invalid API key will cause MailerLite SDK to throw 401 error
    expect(
      addNewsletterSubscriber({
        email: mockEmail,
        subscriptionStart: mockSubscriptionStart,
        membershipExpiresAt: mockMembershipExpires,
        apiKey: mockApiKey,
      }),
    ).rejects.toThrow("Failed to add subscriber to MailerLite");
  });
});
