/**
 * Shared Stripe Test Helpers
 *
 * Reusable utilities for Stripe webhook testing.
 */

import { Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";

/**
 * Generate a unique event ID for test events
 */
export function generateEventId(): string {
  return `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique customer ID
 */
export function generateCustomerId(): string {
  return `cus_test_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique subscription ID
 */
export function generateSubscriptionId(): string {
  return `sub_test_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a unique checkout session ID
 */
export function generateSessionId(): string {
  return `cs_test_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a mock Stripe checkout.session.completed event
 */
export function createMockCheckoutEvent(options: {
  email: string;
  customerName?: string | null;
  customerId?: string;
  subscriptionId?: string;
  eventId?: string;
}): Stripe.Event {
  const {
    email,
    customerName = "Test User",
    customerId = generateCustomerId(),
    subscriptionId = generateSubscriptionId(),
    eventId = generateEventId(),
  } = options;

  return {
    id: eventId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: generateSessionId(),
        object: "checkout.session",
        customer: customerId,
        customer_email: email,
        subscription: subscriptionId,
        customer_details: {
          name: customerName,
          email,
          phone: undefined,
          tax_exempt: "none" as const,
          tax_ids: undefined,
          address: undefined,
        },
        mode: "subscription",
        payment_status: "paid",
        status: "complete",
      } as unknown as Stripe.Checkout.Session,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: undefined,
      idempotency_key: undefined,
    },
    type: "checkout.session.completed",
  } as Stripe.Event;
}

/**
 * Create a Firestore-compatible timestamp for testing
 */
export function createTestTimestamp(daysFromNow = 0): Timestamp {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return Timestamp.fromDate(date);
}

/**
 * Create an expired timestamp (past date)
 */
export function createExpiredTimestamp(): Timestamp {
  const date = new Date();
  date.setDate(date.getDate() - 30); // 30 days ago
  return Timestamp.fromDate(date);
}

/**
 * Create a future timestamp for membership expiration
 */
export function createFutureTimestamp(daysFromNow = 365): Timestamp {
  return createTestTimestamp(daysFromNow);
}

/**
 * Generate a unique test email address
 */
export function generateTestEmail(prefix = "test"): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${random}@example.com`;
}

/**
 * Mock member document structure
 */
export interface MockMemberDocument {
  uid: string;
  email: string;
  name?: string;
  membershipActive: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionStart?: Timestamp;
  membershipExpiresAt?: Timestamp;
  createdAt: Timestamp;
  welcomeEmailStatus?: "sent" | "failed" | "pending";
  welcomeEmailSentAt?: Timestamp;
  welcomeEmailError?: string;
}

/**
 * Create a mock member document for testing
 */
export function createMockMemberDocument(
  options: Partial<MockMemberDocument> & { uid: string; email: string },
): MockMemberDocument {
  return {
    membershipActive: false,
    createdAt: Timestamp.now(),
    ...options,
  };
}

/**
 * Create a mock active member document
 */
export function createActiveMemberDocument(options: {
  uid: string;
  email: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}): MockMemberDocument {
  return createMockMemberDocument({
    ...options,
    membershipActive: true,
    subscriptionStatus: "active",
    subscriptionStart: Timestamp.now(),
    membershipExpiresAt: createFutureTimestamp(365),
    welcomeEmailStatus: "sent",
    welcomeEmailSentAt: Timestamp.now(),
  });
}

/**
 * Create a mock expired member document
 */
export function createExpiredMemberDocument(options: {
  uid: string;
  email: string;
}): MockMemberDocument {
  return createMockMemberDocument({
    ...options,
    membershipActive: false,
    subscriptionStatus: "canceled",
    subscriptionStart: createTestTimestamp(-365),
    membershipExpiresAt: createExpiredTimestamp(),
  });
}

/**
 * Sleep for testing async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for Firestore operation to complete (useful in tests)
 */
export async function waitForFirestoreOperation(
  operation: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await operation()) {
      return true;
    }
    await sleep(intervalMs);
  }

  return false;
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 100,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * 2 ** attempt;
        await sleep(delayMs);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Retry failed with unknown error");
}
