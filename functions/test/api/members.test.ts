import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createApp } from "../../src/api/app.js";
import { NotFoundError } from "../../src/api/errors/http-error.js";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../src/types/member-document.js";

/**
 * Tests for the members endpoint.
 *
 * Uses createApp() factory with mocked services - routes come from app.ts, no duplication needed
 * Tests run WITHOUT Firebase emulators.
 *
 * Run these tests with:
 *   bun test test/api/members.test.ts
 */
describe("GET /members/:memberId", () => {
  // Create mock service
  const mockFindById = mock((memberId: string): Promise<MemberDocument> => {
    if (memberId === "test-member-id") {
      return Promise.resolve({
        uid: "test-member-id",
        email: "test@example.com",
        createdAt: Timestamp.now(),
        name: "Test Member",
        membershipActive: true,
      });
    }
    return Promise.reject(new NotFoundError("Member not found"));
  });

  // Create app with mocked service - routes come from app.ts, no duplication needed
  const testApp = createApp({
    memberService: {
      findById: mockFindById,
    },
  });

  beforeEach(() => {
    mockFindById.mockClear();
  });

  describe("Valid member ID", () => {
    it("should return member data when member exists", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id"),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as MemberDocument;
      expect(body.uid).toBe("test-member-id");
      expect(body.name).toBe("Test Member");
    });

    it("should call memberService.findById with correct ID", async () => {
      await testApp.handle(
        new Request("http://localhost/members/test-member-id"),
      );

      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledWith("test-member-id");
    });

    it("should return 404 when member does not exist", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/non-existent-id"),
      )) as Response;

      expect(response.status).toBe(404);

      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });

  describe("Input validation", () => {
    it("should reject empty member ID", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/"),
      )) as Response;

      expect(response.status).toBe(404);
    });

    it("should reject member IDs longer than 128 characters", async () => {
      const longId = "a".repeat(129);
      const response = (await testApp.handle(
        new Request(`http://localhost/members/${longId}`),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should not call service for invalid member IDs", async () => {
      const longId = "a".repeat(129);
      mockFindById.mockClear();

      await testApp.handle(
        new Request(`http://localhost/members/${longId}`),
      );

      // Service should not be called when validation fails before route handler executes
      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should reject member IDs with URL-encoded forward slashes", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/user%2Fwith%2Fslash"),
      )) as Response;

      // Forward slashes are not valid in Firestore document IDs
      expect(response.status).toBe(404);
    });
  });

  describe("Response format", () => {
    it("should return JSON content type", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id"),
      )) as Response;

      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });
  });

  describe("Error handling", () => {
    it("should handle unexpected errors with logging", async () => {
      // Create mock that throws unexpected error (not HttpError)
      const errorMock = mock();
      const mockFindByIdWithError = mock(() => {
        throw new Error("Database connection timeout");
      });

      const testAppWithError = createApp({
        memberService: {
          findById: mockFindByIdWithError,
        },
        logger: {
          error: errorMock,
          warn: mock(),
          info: mock(),
        },
      });

      const response = (await testAppWithError.handle(
        new Request("http://localhost/members/test-id"),
      )) as Response;

      // Should return 500 for unexpected errors
      expect(response.status).toBe(500);

      // Should return generic error message
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Internal server error");

      // Should have logged the error with context
      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(Array.isArray(errorMock.mock.calls[0])).toBe(true);
      expect(errorMock.mock.calls[0]?.[0]).toBe(
        "Unexpected error in getMember route",
      );

      // Verify error context
      const context = errorMock.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
      expect(context).toBeDefined();
      expect(context?.["errorMessage"]).toBe("Database connection timeout");
      expect(context?.["memberId"]).toBe("test-id");
    });

    it("should handle HttpError correctly without logging as unexpected", async () => {
      const errorMock = mock();

      // HttpError should be handled normally without triggering unexpected error logging
      const testAppWithLogger = createApp({
        memberService: {
          findById: mockFindById,
        },
        logger: {
          error: errorMock,
          warn: mock(),
          info: mock(),
        },
      });

      const response = (await testAppWithLogger.handle(
        new Request("http://localhost/members/non-existent-id"),
      )) as Response;

      // Should return 404 for NotFoundError (which extends HttpError)
      expect(response.status).toBe(404);

      // Should NOT have logged as unexpected error
      expect(errorMock).not.toHaveBeenCalled();
    });
  });
});
