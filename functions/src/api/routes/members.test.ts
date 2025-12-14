import { describe, expect, it, beforeEach, mock } from "bun:test";
import { NotFoundError, AuthError, ForbiddenError } from "../errors/http-error.js";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../types/member-document.js";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createMembersTestPlugin } from "../test-utils/test-app-factory.js";

/**
 * Tests for the authenticated members endpoint.
 *
 * Uses createMembersTestPlugin() factory with mocked services.
 * Tests only the members plugin in isolation - no full app composition needed.
 * Tests run WITHOUT Firebase emulators.
 */
describe("GET /members/:memberId (authenticated)", () => {
  // Create mock services
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

  const mockVerifyOwnerOrAdmin = mock(
    (authorizationHeader: string | undefined, memberId: string): Promise<DecodedIdToken> => {
      if (!authorizationHeader) {
        return Promise.reject(new AuthError("Missing Authorization header"));
      }

      if (authorizationHeader === "Bearer valid-owner-token" && memberId === "test-member-id") {
        return Promise.resolve({
          uid: "test-member-id",
          email: "test@example.com",
        } as DecodedIdToken);
      }

      if (authorizationHeader === "Bearer admin-token") {
        return Promise.resolve({
          uid: "admin-user",
          email: "admin@example.com",
          admin: true,
        } as unknown as DecodedIdToken);
      }

      if (authorizationHeader === "Bearer non-owner-token") {
        return Promise.reject(new ForbiddenError("You can only access your own data"));
      }

      return Promise.reject(new AuthError("Invalid authentication token"));
    },
  );

  // Create plugin with mocked services - tests only the members plugin in isolation
  const testApp = createMembersTestPlugin({
    memberService: {
      findById: mockFindById,
    },
    authService: {
      verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
    },
  });

  beforeEach(() => {
    mockFindById.mockClear();
    mockVerifyOwnerOrAdmin.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id"),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-owner tries to access member data", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id", {
          headers: {
            Authorization: "Bearer non-owner-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You can only access your own data");
    });

    it("should allow owner to access their own member data", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id", {
          headers: {
            Authorization: "Bearer valid-owner-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as MemberDocument;
      expect(body.uid).toBe("test-member-id");
    });

    it("should allow admin to access any member data", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as MemberDocument;
      expect(body.uid).toBe("test-member-id");
    });
  });

  describe("Valid member ID", () => {
    it("should return member data when member exists", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id", {
          headers: {
            Authorization: "Bearer valid-owner-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as MemberDocument;
      expect(body.uid).toBe("test-member-id");
      expect(body.name).toBe("Test Member");
    });

    it("should call memberService.findById with correct ID", async () => {
      await testApp.handle(
        new Request("http://localhost/members/test-member-id", {
          headers: {
            Authorization: "Bearer valid-owner-token",
          },
        }),
      );

      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledWith("test-member-id");
    });

    it("should return 404 when member does not exist", async () => {
      // Mock admin token to access non-existent member
      mockVerifyOwnerOrAdmin.mockImplementationOnce(() =>
        Promise.resolve({
          uid: "admin-user",
          email: "admin@example.com",
          admin: true,
        } as unknown as DecodedIdToken),
      );

      const response = (await testApp.handle(
        new Request("http://localhost/members/non-existent-id", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
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
        new Request("http://localhost/members/user%2Fwith%2Fslash", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      // Forward slashes are not valid in Firestore document IDs
      expect(response.status).toBe(404);
    });
  });

  describe("Response format", () => {
    it("should return JSON content type", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/test-member-id", {
          headers: {
            Authorization: "Bearer valid-owner-token",
          },
        }),
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

      const testAppWithError = createMembersTestPlugin({
        memberService: {
          findById: mockFindByIdWithError,
        },
        authService: {
          verifyOwnerOrAdmin: mock(() =>
            Promise.resolve({
              uid: "test-id",
              admin: false,
            } as unknown as DecodedIdToken),
          ),
        },
        logger: {
          error: errorMock,
          warn: mock(),
          info: mock(),
        },
      });

      const response = (await testAppWithError.handle(
        new Request("http://localhost/members/test-id", {
          headers: {
            Authorization: "Bearer valid-owner-token",
          },
        }),
      )) as Response;

      // Should return 500 for unexpected errors
      expect(response.status).toBe(500);

      // Should return descriptive error message
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to retrieve member data");

      // Should have logged the error with context
      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(Array.isArray(errorMock.mock.calls[0])).toBe(true);
      expect(errorMock.mock.calls[0]?.[0]).toBe("Failed to fetch member data");

      // Verify error context includes authentication info
      const context = errorMock.mock.calls[0]?.[1] as
        | Record<string, unknown>
        | undefined;
      expect(context).toBeDefined();
      expect(context?.["errorMessage"]).toBe("Database connection timeout");
      expect(context?.["memberId"]).toBe("test-id");
      expect(context?.["hasAuthorizationHeader"]).toBe(true);
    });

    it("should handle HttpError correctly without logging as unexpected", async () => {
      const errorMock = mock();

      // HttpError should be handled normally without triggering unexpected error logging
      const testAppWithLogger = createMembersTestPlugin({
        memberService: {
          findById: mockFindById,
        },
        authService: {
          verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
        },
        logger: {
          error: errorMock,
          warn: mock(),
          info: mock(),
        },
      });

      const response = (await testAppWithLogger.handle(
        new Request("http://localhost/members/non-existent-id", {
          headers: {
            Authorization: "Bearer admin-token",
          },
        }),
      )) as Response;

      // Should return 404 for NotFoundError (which extends HttpError)
      expect(response.status).toBe(404);

      // Should NOT have logged as unexpected error
      expect(errorMock).not.toHaveBeenCalled();
    });
  });
});
