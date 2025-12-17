import { describe, expect, it, mock, beforeEach } from "bun:test";
import { HttpsError } from "firebase-functions/v2/identity";
import type { AuthBlockingEvent } from "firebase-functions/v2/identity";

// Mock firebase-admin/firestore
const mockGet = mock(() => Promise.resolve({ exists: false }));
const mockSet = mock(() => Promise.resolve());
const mockDocument = mock(() => ({ get: mockGet, set: mockSet }));
const mockCollection = mock(() => ({ doc: mockDocument }));
const mockGetFirestore = mock(() => ({ collection: mockCollection }));

void mock.module("firebase-admin/firestore", () => ({
  getFirestore: mockGetFirestore,
  Timestamp: {
    now: () => ({ seconds: 1_234_567_890, nanoseconds: 0 }),
  },
}));

// Import after mocking
const { handleBeforeUserCreated } = await import("./before-user-created.js");

/**
 * Tests for handleBeforeUserCreated blocking function handler.
 *
 * These tests verify the handler's behavior with mocked Firestore.
 * The function creates member documents and sets admin claims.
 */
describe("handleBeforeUserCreated", () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockSet.mockClear();
    mockDocument.mockClear();
    mockCollection.mockClear();
    mockGet.mockImplementation(() => Promise.resolve({ exists: false }));
  });

  const createMockEvent = (
    overrides: Partial<{ uid: string; email: string | undefined }> = {},
  ): AuthBlockingEvent => {
    const email =
      "email" in overrides ? overrides.email : "test@example.com";
    return {
      data: {
        uid: overrides.uid ?? "test-uid-123",
        email,
        emailVerified: false,
        disabled: false,
        metadata: {
          creationTime: new Date().toISOString(),
        },
        providerData: [],
        customClaims: {},
        tokensValidAfterTime: undefined,
        toJSON: () => ({}),
      },
      credential: undefined,
      eventId: "event-123",
      eventType: "beforeCreate",
      params: {},
      timestamp: new Date().toISOString(),
      locale: undefined,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    } as unknown as AuthBlockingEvent;
  };

  describe("Email validation", () => {
    it("should throw HttpsError when email is missing", async () => {
      const event = createMockEvent({ email: undefined });

      let caughtError: unknown;
      try {
        await handleBeforeUserCreated(event);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(HttpsError);
      expect((caughtError as HttpsError).message).toBe(
        "User email is required",
      );
    });
  });

  describe("Member document creation", () => {
    it("should create member document with correct data", async () => {
      const event = createMockEvent({
        uid: "new-user-uid",
        email: "newuser@example.com",
      });

      await handleBeforeUserCreated(event);

      expect(mockCollection).toHaveBeenCalledWith("members");
      expect(mockDocument).toHaveBeenCalledWith("new-user-uid");
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(mockSet.mock.calls[0]?.[0]).toEqual({
        createdAt: { seconds: 1_234_567_890, nanoseconds: 0 },
        email: "newuser@example.com",
        uid: "new-user-uid",
        membershipActive: false,
      });
    });

    it("should skip creation if document already exists", async () => {
      mockGet.mockImplementation(() => Promise.resolve({ exists: true }));
      const event = createMockEvent({ uid: "existing-user-uid" });

      await handleBeforeUserCreated(event);

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe("Admin claim assignment", () => {
    it("should return admin claim for admin email", async () => {
      const event = createMockEvent({
        email: "webmaster@doulacooperative.com",
      });

      const result = await handleBeforeUserCreated(event);

      expect(result).toEqual({ customClaims: { admin: true } });
    });

    it("should return admin claim for admin email (case insensitive)", async () => {
      const event = createMockEvent({
        email: "Webmaster@DoulaCooperative.com",
      });

      const result = await handleBeforeUserCreated(event);

      expect(result).toEqual({ customClaims: { admin: true } });
    });

    it("should return empty object for non-admin email", async () => {
      const event = createMockEvent({ email: "regular@example.com" });

      const result = await handleBeforeUserCreated(event);

      expect(result).toEqual({});
    });
  });
});
