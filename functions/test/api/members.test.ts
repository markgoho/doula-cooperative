import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createApp } from "../../src/api/app.js";
import { NotFoundError } from "../../src/api/errors/http-error.js";

/**
 * Tests for the members endpoint.
 *
 * Uses createApp() factory with mocked services - no duplication!
 * Tests run WITHOUT Firebase emulators.
 *
 * Run these tests with:
 *   bun test test/api/members.test.ts
 */
describe("GET /members/:memberId", () => {
  // Create mock service
  const mockFindById = mock((memberId: string) => {
    if (memberId === "test-member-id") {
      return Promise.resolve({
        id: "test-member-id",
        name: "Test Member",
        email: "test@example.com",
      });
    }
    return Promise.reject(new NotFoundError("Member not found"));
  });

  // Create app with mocked service - no route duplication!
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
      const body = (await response.json()) as { id?: string; name?: string };
      expect(body.id).toBe("test-member-id");
      expect(body.name).toBe("Test Member");
    });

    it("should call memberService.findById with correct ID", async () => {
      await testApp.handle(
        new Request("http://localhost/members/test-member-id"),
      );

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

      // Elysia will return 404 for unmatched route
      expect(response.status).toBe(404);
    });

    it("should reject member IDs longer than 128 characters", async () => {
      const longId = "a".repeat(129);
      const response = (await testApp.handle(
        new Request(`http://localhost/members/${longId}`),
      )) as Response;

      // Validation error from Elysia schema
      expect(response.status).toBe(422);
    });

    it("should not call service for invalid member IDs", async () => {
      const longId = "a".repeat(129);
      mockFindById.mockClear();

      await testApp.handle(
        new Request(`http://localhost/members/${longId}`),
      );

      // Service should not be called because validation fails first
      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle member IDs with URL-encoded characters", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/members/user%2Fwith%2Fslash"),
      )) as Response;

      // Should either decode and handle or return 404/400
      expect([404, 400, 422] as number[]).toContain(response.status);
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
});
