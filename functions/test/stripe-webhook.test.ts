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
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Response } from "express";
import Stripe from "stripe";
import { MEMBERS_COLLECTION } from "../src/constants/collections";
import { handler } from "../src/stripe-webhook/handler";
import {
  cleanupTestMembers,
  getMemberData,
} from "../src/test-utils/firestore-helpers";
import { createMockResponse } from "../src/test-utils/mock-response";
import { initializeTest } from "../src/test-utils/test-setup";

const test = initializeTest();

interface SetupOptions {
  testEmail?: string;
  includeStripeSignature?: boolean;
  includeStripeSecrets?: boolean;
  includeMailgunKey?: boolean;
  eventType?: string;
  customerName?: string | null | undefined;
  includeCustomerEmail?: boolean;
  mockStripeError?: boolean;
}

function setup(options: SetupOptions = {}) {
  const {
    testEmail = "stripe-test@example.com",
    includeStripeSignature = true,
    includeStripeSecrets = true,
    includeMailgunKey = true,
    eventType = "checkout.session.completed",
    includeCustomerEmail = true,
    mockStripeError = false,
  } = options;

  // Default customerName to "Test User" only if not explicitly provided (not even as undefined)
  const customerName = "customerName" in options ? options.customerName : "Test User";

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
      name: customerName,
      email: testEmail,
      phone: null,
      tax_exempt: "none" as const,
      tax_ids: null,
      address: null,
    },
  } as unknown as Stripe.Checkout.Session;

  const mockEvent = {
    id: "evt_test_123",
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
  afterAll(async () => {
    await cleanupTestMembers({ firestore: getFirestore() });
    test.cleanup();
  });

  describe("Configuration validation", () => {
    it("should return 500 if STRIPE_API_KEY is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeStripeSecrets: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(500);
      expect(mockResponse.body).toBe("Stripe integration not configured");

      restoreEnvironment(originalEnvironment);
    });

    it("should return 400 if stripe-signature header is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeStripeSignature: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(400);
      expect(mockResponse.body).toBe("Missing signature");

      restoreEnvironment(originalEnvironment);
    });
  });

  describe("Webhook signature verification", () => {
    it("should return 400 if signature verification fails", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        mockStripeError: true,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(400);
      expect(mockResponse.body).toBe("Webhook signature verification failed");

      restoreEnvironment(originalEnvironment);
    });
  });

  describe("checkout.session.completed event", () => {
    it("should return 400 if customer_email is missing", async () => {
      // Arrange
      const { mockRequest, mockResponse, originalEnvironment } = setup({
        includeCustomerEmail: false,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      expect(mockResponse.statusCode).toBe(400);
      expect(mockResponse.body).toBe("Missing customer email");

      restoreEnvironment(originalEnvironment);
    });

    it("should create new user if user does not exist", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `newuser-${String(Date.now())}@example.com`,
      });

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const userRecord = await auth.getUserByEmail(testEmail);
      expect(userRecord).toBeDefined();
      expect(userRecord.email).toBe(testEmail);

      // Check response body
      const responseBody = mockResponse.body as {
        received: boolean;
        userId: string;
      };
      expect(responseBody.received).toBe(true);
      expect(responseBody.userId).toBe(userRecord.uid);

      // Cleanup
      await auth.deleteUser(userRecord.uid);
      await cleanupTestMembers({ firestore });
      restoreEnvironment(originalEnvironment);
    });

    it("should create member document for new user with correct fields", async () => {
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
        testEmail: `newmember-${String(Date.now())}@example.com`,
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
      expect(memberData?.uid).toBe(userRecord.uid);
      expect(memberData?.email).toBe(testEmail);
      expect(memberData?.name).toBe("New Member");
      expect(memberData?.membershipActive).toBe(true);
      expect(memberData?.stripeCustomerId).toBe(
        typeof mockSession.customer === "string"
          ? mockSession.customer
          : undefined,
      );
      expect(memberData?.stripeSubscriptionId).toBe(
        typeof mockSession.subscription === "string"
          ? mockSession.subscription
          : undefined,
      );
      expect(memberData?.subscriptionStatus).toBe("active");
      expect(memberData?.subscriptionStart).toBeDefined();
      expect(memberData?.membershipExpiresAt).toBeDefined();
      expect(memberData?.createdAt).toBeDefined();

      // Cleanup
      await auth.deleteUser(userRecord.uid);
      await cleanupTestMembers({ firestore });
      restoreEnvironment(originalEnvironment);
    });

    it("should calculate correct expiration date for new subscription", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `expiration-${String(Date.now())}@example.com`,
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
      expect(memberData?.subscriptionStart).toBeDefined();

      // Type narrowing - we know these exist from the assertions above
      if (!memberData?.subscriptionStart || !memberData.membershipExpiresAt) {
        throw new Error("Expected memberData with subscription fields");
      }

      const subscriptionStart = memberData.subscriptionStart.toDate();
      const expirationDate = memberData.membershipExpiresAt.toDate();

      // Expiration should be in the same month as subscription start
      expect(expirationDate.getMonth()).toBe(subscriptionStart.getMonth());

      // Expiration should be the last day of the month
      const lastDayOfMonth = new Date(
        expirationDate.getFullYear(),
        expirationDate.getMonth() + 1,
        0,
      ).getDate();
      expect(expirationDate.getDate()).toBe(lastDayOfMonth);

      // Expiration should be this year or next year
      const currentYear = new Date().getFullYear();
      const isThisYearOrNext =
        expirationDate.getFullYear() === currentYear ||
        expirationDate.getFullYear() === currentYear + 1;
      expect(isThisYearOrNext).toBe(true);

      // Cleanup
      await auth.deleteUser(userRecord.uid);
      await cleanupTestMembers({ firestore });
      restoreEnvironment(originalEnvironment);
    });

    it("should update existing user with Stripe subscription data", async () => {
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
        testEmail: `existing-${String(Date.now())}@example.com`,
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
      expect(memberData?.stripeCustomerId).toBe(
        typeof mockSession.customer === "string"
          ? mockSession.customer
          : undefined,
      );
      expect(memberData?.stripeSubscriptionId).toBe(
        typeof mockSession.subscription === "string"
          ? mockSession.subscription
          : undefined,
      );
      expect(memberData?.subscriptionStatus).toBe("active");
      expect(memberData?.subscriptionStart).toBeDefined();
      expect(memberData?.membershipExpiresAt).toBeDefined();

      // Check response body
      const responseBody = mockResponse.body as {
        received: boolean;
        userId: string;
      };
      expect(responseBody.received).toBe(true);
      expect(responseBody.userId).toBe(existingUser.uid);

      // Cleanup
      await auth.deleteUser(existingUser.uid);
      await cleanupTestMembers({ firestore });
      restoreEnvironment(originalEnvironment);
    });

    it("should preserve existing member data when updating", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `preserve-${String(Date.now())}@example.com`,
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

      // Act
      await handler(mockRequest as never, mockResponse as unknown as Response);

      // Assert
      const memberData = await getMemberData({
        firestore,
        uid: existingUser.uid,
      });

      // New fields should be added
      expect(memberData?.membershipActive).toBe(true);
      expect(memberData?.stripeCustomerId).toBeDefined();

      // Existing fields should be preserved
      expect(memberData?.slug).toBe("existing-slug");
      expect(memberData?.hasProfile).toBe(true);
      expect(memberData?.name).toBe("Existing Name");

      // Cleanup
      await auth.deleteUser(existingUser.uid);
      await cleanupTestMembers({ firestore });
      restoreEnvironment(originalEnvironment);
    });

    it("should handle missing customer name gracefully", async () => {
      // Arrange
      const {
        mockRequest,
        mockResponse,
        testEmail,
        auth,
        firestore,
        originalEnvironment,
      } = setup({
        testEmail: `noname-${String(Date.now())}@example.com`,
        customerName: undefined,
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
      expect(memberData?.membershipActive).toBe(true);

      // Cleanup
      await auth.deleteUser(userRecord.uid);
      await cleanupTestMembers({ firestore });
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
    it("should return 500 when Firebase Auth user creation fails", async () => {
      // Arrange
      const testEmail = `auth-fail-${Date.now()}@example.com`;
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
      expect(mockResponse.body).toBe("Unable to create account");

      // Verify no member document was created
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

    it("should return 500 when Firestore member document creation fails after user created", async () => {
      // Arrange
      const testEmail = `doc-fail-${Date.now()}@example.com`;
      const { mockRequest, mockResponse, auth, firestore, originalEnvironment } = setup({
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
      expect(mockResponse.statusCode).toBe(500);
      expect(mockResponse.body).toBe(
        "Account created but setup incomplete - support will contact you"
      );
      expect(setCallCount).toBeGreaterThan(0);

      // Verify auth user WAS created (orphaned)
      const userRecord = await auth.getUserByEmail(testEmail);
      expect(userRecord).toBeDefined();

      // Cleanup - delete the orphaned user
      await auth.deleteUser(userRecord.uid);
      firestore.collection = originalCollection as never;
      restoreEnvironment(originalEnvironment);
    });

    it("should return 500 when member document update fails for existing user", async () => {
      // Arrange
      const testEmail = `update-fail-${Date.now()}@example.com`;
      const { mockRequest, mockResponse, auth, firestore, originalEnvironment } = setup({
        testEmail,
      });

      // Create existing user and member document first
      const existingUser = await auth.createUser({
        email: testEmail,
        password: "test-password",
      });
      await firestore
        .collection(MEMBERS_COLLECTION)
        .doc(existingUser.uid)
        .set({
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
      expect(mockResponse.body).toBe("Unable to update membership");

      // Verify member document was NOT updated (still inactive)
      const memberData = await getMemberData({
        firestore: originalCollection("members") as never,
        uid: existingUser.uid,
      });
      expect(memberData?.membershipActive).toBe(false);
      expect(memberData?.stripeCustomerId).toBeUndefined();

      // Cleanup
      await auth.deleteUser(existingUser.uid);
      await cleanupTestMembers({ firestore: originalCollection("members") as never });
      firestore.collection = originalCollection as never;
      restoreEnvironment(originalEnvironment);
    });
  });
});
