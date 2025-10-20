/**
 * Stripe Webhook Handler Tests
 *
 * NOTE: These tests require Firebase emulators to be running:
 * - Firestore emulator on 127.0.0.1:8080
 * - Auth emulator on 127.0.0.1:9099
 *
 * Start emulators with: bun run emulators:start
 */
import { afterAll, describe, expect, it, mock } from "bun:test";
import type { Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";
import { MEMBERS_COLLECTION } from "../src/constants/collections";
import { handler } from "../src/stripe-webhook/handler";
import { getMemberData } from "../src/test-utils/firestore-helpers";
import { createMockResponse } from "../src/test-utils/mock-response";
import { initializeTest } from "../src/test-utils/test-setup";

const test = initializeTest();

interface SetupOptions {
  testEmail?: string;
  includeStripeSignature?: boolean;
  includeStripeSecrets?: boolean;
  includeMailgunKey?: boolean;
  eventType?: string;
  customerName?: string | null;
  includeCustomerEmail?: boolean;
  mockStripeError?: boolean;
}

function setup({
  testEmail = "stripe-test@example.com",
  includeStripeSignature = true,
  includeStripeSecrets = true,
  includeMailgunKey = true,
  eventType = "checkout.session.completed",
  customerName = "Test User",
  includeCustomerEmail = true,
  mockStripeError = false,
}: SetupOptions = {}) {
  // Use customerName as-is (including null if explicitly passed)
  const finalCustomerName = customerName;

  const firestore = getFirestore();
  const auth = getAuth();

  /* eslint-disable unicorn/no-null -- Stripe types require null for these fields */
  // Mock Stripe webhook event - partial mock with only required fields for testing
  const mockSession = {
    id: "cs_test_123",
    object: "checkout.session",
    customer: "cus_test_123",
    customer_email: includeCustomerEmail ? testEmail : undefined,
    subscription: "sub_test_123",
    customer_details: {
      name: finalCustomerName,
      email: includeCustomerEmail ? testEmail : undefined,
      phone: null,
      tax_exempt: "none" as const,
      tax_ids: null,
      address: null,
    },
  } as unknown as Stripe.Checkout.Session;

  // Generate unique event ID per test to avoid idempotency conflicts
  const uniqueEventId = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const mockEvent = {
    id: uniqueEventId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: mockSession,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: eventType,
  } as unknown as Stripe.Event;

  // Mock request
  const mockRequest = {
    headers: includeStripeSignature
      ? { "stripe-signature": "test-signature" }
      : {},
    rawBody: Buffer.from(JSON.stringify(mockEvent)),
  };

  // Mock response
  const mockResponse = createMockResponse();

  // Set environment variables
  const originalEnvironment = { ...process.env };

  if (includeStripeSecrets) {
    process.env.STRIPE_API_KEY = "sk_test_mock_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock_secret";
  } else {
    delete process.env.STRIPE_API_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }

  if (includeMailgunKey) {
    process.env.MAILGUN_API_KEY = "test-mailgun-key";
  } else {
    delete process.env.MAILGUN_API_KEY;
  }

  // Enable emulator mode to skip actual email sending
  process.env.FUNCTIONS_EMULATOR = "true";

  // Create a mock Stripe instance to capture the constructor
  const stripe = new Stripe("sk_test_mock");

  // Mock Stripe webhook verification
  stripe.webhooks.constructEvent = mockStripeError
    ? (mock(() => {
        throw new Error("Invalid signature");
      }) as never)
    : (mock(() => mockEvent) as never);

  return {
    testEmail,
    firestore,
    auth,
    mockRequest,
    mockResponse,
    mockEvent,
    mockSession,
    originalEnvironment,
    stripe, // Return the mocked stripe instance
  };
}

function restoreEnvironment(originalEnvironment: NodeJS.ProcessEnv) {
  process.env = originalEnvironment;
}

// No longer needed - using module-level mocking

describe("stripeWebhook handler", () => {
  afterAll(() => {
    test.cleanup();
  });

  describe("Configuration validation", () => {
    it("should return 500 status if STRIPE_API_KEY is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeStripeSecrets: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(500);

      restoreEnvironment(originalEnvironment);
    });

    it("should return error message if STRIPE_API_KEY is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeStripeSecrets: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toBe("Stripe integration not configured");

      restoreEnvironment(originalEnvironment);
    });

    it("should return 400 status if stripe-signature header is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeStripeSignature: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(400);

      restoreEnvironment(originalEnvironment);
    });

    it("should return error message if stripe-signature header is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeStripeSignature: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toBe("Missing signature");

      restoreEnvironment(originalEnvironment);
    });
  });

  describe("Webhook signature verification", () => {
    it("should return 400 status if signature verification fails", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        mockStripeError: true,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(400);

      restoreEnvironment(originalEnvironment);
    });

    it("should return error message if signature verification fails", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        mockStripeError: true,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toBe("Webhook signature verification failed");

      restoreEnvironment(originalEnvironment);
    });
  });

  describe("checkout.session.completed event", () => {
    it("should return 400 status if customer_email is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeCustomerEmail: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(400);

      restoreEnvironment(originalEnvironment);
    });

    it("should return error message if customer_email is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeCustomerEmail: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toBe("Missing customer email");

      restoreEnvironment(originalEnvironment);
    });

    it("should create member document for new user", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "create-member-document@example.com",
        customerName: "New Member",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData).toBeDefined();

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set uid in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "set-uid-in-member@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.uid).toBe(userRecord.uid);

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set email in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "set-email-in-member@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.email).toBe(testEmail);

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set name in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "set-name-in-member@example.com",
        customerName: "New Member",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.name).toBe("New Member");

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set membershipActive to true in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "set-membership-active@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.membershipActive).toBe(true);

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set stripeCustomerId in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        mockSession,
        originalEnvironment,
      } = setup({
        testEmail: "member-customer@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.stripeCustomerId).toBe(
        typeof mockSession.customer === "string"
          ? mockSession.customer
          : undefined,
      );

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set stripeSubscriptionId in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        mockSession,
        originalEnvironment,
      } = setup({
        testEmail: "member-subscription@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.stripeSubscriptionId).toBe(
        typeof mockSession.subscription === "string"
          ? mockSession.subscription
          : undefined,
      );

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set subscriptionStatus to active in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "member-status@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.subscriptionStatus).toBe("active");

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set subscriptionStart in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "member-start@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.subscriptionStart).toBeDefined();

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set membershipExpiresAt in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: "member-expires@example.com",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.membershipExpiresAt).toBeDefined();

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set createdAt in member document", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `member-created@example.com`,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.createdAt).toBeDefined();

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set expiration date in same month as subscription start", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `expiration-month@example.com`,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });

      // Type narrowing
      if (!memberData?.subscriptionStart || !memberData.membershipExpiresAt) {
        throw new Error("Expected memberData with subscription fields");
      }

      const subscriptionStart = memberData.subscriptionStart.toDate();
      const expirationDate = memberData.membershipExpiresAt.toDate();

      expect(expirationDate.getMonth()).toBe(subscriptionStart.getMonth());

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set expiration date to last day of month", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `expiration-lastday@example.com`,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });

      // Type narrowing
      if (!memberData?.membershipExpiresAt) {
        throw new Error("Expected memberData with membershipExpiresAt");
      }

      const expirationDate = memberData.membershipExpiresAt.toDate();
      const lastDayOfMonth = new Date(
        expirationDate.getFullYear(),
        expirationDate.getMonth() + 1,
        0,
      ).getDate();

      expect(expirationDate.getDate()).toBe(lastDayOfMonth);

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set expiration date to current or next year", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `expiration-year@example.com`,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });

      // Type narrowing
      if (!memberData?.membershipExpiresAt) {
        throw new Error("Expected memberData with membershipExpiresAt");
      }

      const expirationDate = memberData.membershipExpiresAt.toDate();
      const currentYear = new Date().getFullYear();
      const isThisYearOrNext =
        expirationDate.getFullYear() === currentYear ||
        expirationDate.getFullYear() === currentYear + 1;

      expect(isThisYearOrNext).toBe(true);

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should activate membership for existing user", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `existing-active@example.com`,
      });

      // Create existing user first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      // Create basic member document
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.membershipActive).toBe(true);

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set stripeCustomerId for existing user", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        mockSession,
        originalEnvironment,
      } = setup({
        testEmail: `existing-customer@example.com`,
      });

      // Create existing user first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      // Create basic member document
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.stripeCustomerId).toBe(
        typeof mockSession.customer === "string"
          ? mockSession.customer
          : undefined,
      );

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set stripeSubscriptionId for existing user", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        mockSession,
        originalEnvironment,
      } = setup({
        testEmail: `existing-subscription@example.com`,
      });

      // Create existing user first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      // Create basic member document
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.stripeSubscriptionId).toBe(
        typeof mockSession.subscription === "string"
          ? mockSession.subscription
          : undefined,
      );

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set subscriptionStatus for existing user", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `existing-status@example.com`,
      });

      // Create existing user first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      // Create basic member document
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.subscriptionStatus).toBe("active");

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set subscriptionStart for existing user", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `existing-start@example.com`,
      });

      // Create existing user first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      // Create basic member document
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.subscriptionStart).toBeDefined();

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should set membershipExpiresAt for existing user", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `existing-expires@example.com`,
      });

      // Create existing user first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      // Create basic member document
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.membershipExpiresAt).toBeDefined();

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should add stripeCustomerId when updating existing member", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `preserve-customer@example.com`,
      });

      // Create existing user with profile data
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
        slug: "existing-slug",
        hasProfile: true,
        name: "Existing Name",
      });

      // Small delay to ensure initial document write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.stripeCustomerId).toBeDefined();

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should preserve slug when updating existing member", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `preserve-slug@example.com`,
      });

      // Create existing user with profile data
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
        slug: "existing-slug",
        hasProfile: true,
        name: "Existing Name",
      });

      // Small delay to ensure initial document write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.slug).toBe("existing-slug");

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should preserve hasProfile when updating existing member", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `preserve-profile@example.com`,
      });

      // Create existing user with profile data
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
        slug: "existing-slug",
        hasProfile: true,
        name: "Existing Name",
      });

      // Small delay to ensure initial document write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.hasProfile).toBe(true);

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should preserve name when updating existing member", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `preserve-name@example.com`,
      });

      // Create existing user with profile data
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });

      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
        slug: "existing-slug",
        hasProfile: true,
        name: "Existing Name",
      });

      // Small delay to ensure initial document write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.name).toBe("Existing Name");

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should not set name when customer name is missing", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `should-not-set-name@example.com`,
        customerName: null,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.name).toBeUndefined();

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should still activate membership when customer name is missing", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `noname-active@example.com`,
        customerName: null,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Small delay to ensure document write completes before reading
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      const memberData = await getMemberData({
        firestore,
        uid: userRecord.uid,
      });
      expect(memberData?.membershipActive).toBe(true);

      // Cleanup
      await auth.deleteUser(userRecord.uid);

      restoreEnvironment(originalEnvironment);
    });
  });

  describe("Unhandled event types", () => {
    it("should return success for unhandled event types", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        eventType: "customer.subscription.updated",
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toEqual({ received: true });

      restoreEnvironment(originalEnvironment);
    });
  });

  describe("Error handling - Critical paths", () => {
    it("should return 500 status when Firebase Auth user creation fails", async () => {
      // Arrange
      const testEmail = `auth-fail-status-${Date.now()}@example.com`;
      const { mockRequest, mockResponse, auth, originalEnvironment } = setup({
        testEmail,
      });

      // Mock auth.createUser to throw an error
      const originalCreateUser = auth.createUser.bind(auth);
      auth.createUser = mock(() => {
        throw new Error("auth/quota-exceeded");
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(500);

      // Cleanup
      auth.createUser = originalCreateUser as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should return error message when Firebase Auth user creation fails", async () => {
      // Arrange
      const testEmail = `auth-fail-message-${Date.now()}@example.com`;
      const { mockRequest, mockResponse, auth, originalEnvironment } = setup({
        testEmail,
      });

      // Mock auth.createUser to throw an error
      const originalCreateUser = auth.createUser.bind(auth);
      auth.createUser = mock(() => {
        throw new Error("auth/quota-exceeded");
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toBe("Unable to create account");

      // Cleanup
      auth.createUser = originalCreateUser as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should not create user when Firebase Auth user creation fails", async () => {
      // Arrange
      const testEmail = `auth-fail-nouser-${Date.now()}@example.com`;
      const { mockRequest, mockResponse, auth, originalEnvironment } = setup({
        testEmail,
      });

      // Mock auth.createUser to throw an error
      const originalCreateUser = auth.createUser.bind(auth);
      auth.createUser = mock(() => {
        throw new Error("auth/quota-exceeded");
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert - Verify no member document was created
      try {
        await auth.getUserByEmail(testEmail);
        expect.unreachable("User should not have been created");
      } catch (error: unknown) {
        // Expected - user doesn't exist
        expect(error).toBeDefined();
      }

      // Cleanup
      auth.createUser = originalCreateUser as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should return 500 status when Firestore member document creation fails", async () => {
      // Arrange
      const testEmail = `doc-fail-status-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Mock Firestore collection().doc().set() to fail
      const originalCollection = firestore.collection.bind(firestore);
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            documentReference.set = mock(() => {
              throw new Error("Firestore write timeout");
            }) as never;
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(500);

      // Cleanup
      try {
        const userRecord = await auth.getUserByEmail(testEmail);
        await auth.deleteUser(userRecord.uid);
      } catch {
        // User may not exist
      }
      firestore.collection = originalCollection as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should return error message when Firestore member document creation fails", async () => {
      // Arrange
      const testEmail = `doc-fail-message-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Mock Firestore collection().doc().set() to fail
      const originalCollection = firestore.collection.bind(firestore);
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            documentReference.set = mock(() => {
              throw new Error("Firestore write timeout");
            }) as never;
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toBe(
        "Account created but setup incomplete - support will contact you",
      );

      // Cleanup
      try {
        const userRecord = await auth.getUserByEmail(testEmail);
        await auth.deleteUser(userRecord.uid);
      } catch {
        // User may not exist
      }
      firestore.collection = originalCollection as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should attempt to write when Firestore member document creation fails", async () => {
      // Arrange
      const testEmail = `doc-fail-attempt-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Mock Firestore collection().doc().set() to fail
      const originalCollection = firestore.collection.bind(firestore);
      let setCallCount = 0;
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            documentReference.set = mock(() => {
              setCallCount++;
              throw new Error("Firestore write timeout");
            }) as never;
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(setCallCount).toBeGreaterThan(0);

      // Cleanup
      try {
        const userRecord = await auth.getUserByEmail(testEmail);
        await auth.deleteUser(userRecord.uid);
      } catch {
        // User may not exist
      }
      firestore.collection = originalCollection as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should create orphaned auth user when Firestore member document creation fails", async () => {
      // Arrange
      const testEmail = `doc-fail-orphan-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Mock Firestore collection().doc().set() to fail
      const originalCollection = firestore.collection.bind(firestore);
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            documentReference.set = mock(() => {
              throw new Error("Firestore write timeout");
            }) as never;
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert - Verify auth user WAS created (orphaned)
      const userRecord = await auth.getUserByEmail(testEmail);
      expect(userRecord).toBeDefined();

      // Cleanup - delete the orphaned user
      await auth.deleteUser(userRecord.uid);
      firestore.collection = originalCollection as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should return 500 status when member document update fails for existing user", async () => {
      // Arrange
      const testEmail = `update-fail-status-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Create existing user and member document first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Mock Firestore set to fail on update
      const originalCollection = firestore.collection.bind(firestore);
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            if (documentId === existingUser.uid) {
              documentReference.set = mock(() => {
                throw new Error("Firestore permission denied");
              }) as never;
            }
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(500);

      // Cleanup
      firestore.collection = originalCollection as never;
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should return error message when member document update fails for existing user", async () => {
      // Arrange
      const testEmail = `update-fail-message-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Create existing user and member document first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Mock Firestore set to fail on update
      const originalCollection = firestore.collection.bind(firestore);
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            if (documentId === existingUser.uid) {
              documentReference.set = mock(() => {
                throw new Error("Firestore permission denied");
              }) as never;
            }
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.body).toBe("Unable to update membership");

      // Cleanup
      firestore.collection = originalCollection as never;
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should not update membershipActive when member document update fails", async () => {
      // Arrange
      const testEmail = `update-fail-active-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Create existing user and member document first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Mock Firestore set to fail on update
      const originalCollection = firestore.collection.bind(firestore);
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            if (documentId === existingUser.uid) {
              documentReference.set = mock(() => {
                throw new Error("Firestore permission denied");
              }) as never;
            }
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Restore collection before verifying
      firestore.collection = originalCollection as never;

      // Assert - Verify member document was NOT updated (still inactive)
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.membershipActive).toBe(false);

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });

    it("should not add stripeCustomerId when member document update fails", async () => {
      // Arrange
      const testEmail = `update-fail-customer-${Date.now()}@example.com`;
      const {
        mockRequest,
        mockResponse,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail,
      });

      // Create existing user and member document first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });
      await firestore.collection(MEMBERS_COLLECTION).doc(existingUser.uid).set({
        uid: existingUser.uid,
        email: testEmail,
        membershipActive: false,
        createdAt: Timestamp.now(),
      });

      // Mock Firestore set to fail on update
      const originalCollection = firestore.collection.bind(firestore);
      firestore.collection = mock((path: string) => {
        const collection = originalCollection(path);
        if (path === MEMBERS_COLLECTION) {
          const originalDocument = collection.doc.bind(collection);
          collection.doc = mock((documentId: string) => {
            const documentReference = originalDocument(documentId);
            if (documentId === existingUser.uid) {
              documentReference.set = mock(() => {
                throw new Error("Firestore permission denied");
              }) as never;
            }
            return documentReference;
          }) as never;
        }
        return collection;
      }) as never;

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Restore collection before verifying
      firestore.collection = originalCollection as never;

      // Assert - Verify member document was NOT updated
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });
      expect(memberData?.stripeCustomerId).toBeUndefined();

      // Cleanup
      await auth.deleteUser(existingUser.uid);

      restoreEnvironment(originalEnvironment);
    });
  });
});
