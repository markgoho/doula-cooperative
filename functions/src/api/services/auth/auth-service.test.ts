/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { describe, expect, it } from "bun:test";
import { AuthError } from "../../errors/http-error.js";

// Import auth service functions directly
const { verifyAuthToken } = await import(
  "./verify-token.js"
);

/**
 * Tests for AuthService input validation (no Firebase mocking).
 *
 * These tests verify input validation logic without mocking Firebase internals.
 * Token verification tests that require Firebase Auth are in the integration tests
 * where the AuthService interface is mocked at the route level.
 *
 * Run these tests with:
 *   bun test test/api/auth-service.test.ts
 */
describe("AuthService", () => {
  describe("verifyAuthToken - Input Validation", () => {
    it("should throw AuthError when authorization header is missing", async () => {
      await expect(verifyAuthToken(undefined)).rejects.toThrow(AuthError);

      await expect(verifyAuthToken(undefined)).rejects.toThrow(
        "Missing Authorization header",
      );
    });

    it("should throw AuthError for non-Bearer authorization schemes", async () => {
      await expect(verifyAuthToken("Basic dXNlcjpwYXNz")).rejects.toThrow(
        AuthError,
      );

      await expect(verifyAuthToken("Basic dXNlcjpwYXNz")).rejects.toThrow(
        "Authorization header must use Bearer scheme",
      );
    });

    it("should throw AuthError for empty Bearer tokens", async () => {
      await expect(verifyAuthToken("Bearer ")).rejects.toThrow(AuthError);

      await expect(verifyAuthToken("Bearer ")).rejects.toThrow(
        "Missing auth token",
      );
    });

    it("should throw AuthError for whitespace-only tokens", async () => {
      await expect(verifyAuthToken("Bearer   ")).rejects.toThrow(AuthError);

      await expect(verifyAuthToken("Bearer   ")).rejects.toThrow(
        "Missing auth token",
      );
    });
  });

  describe("verifyAuthToken - Token Verification", () => {
    it.skip("Token verification tests require Firebase Auth integration", () => {
      // These tests should mock the AuthService at the route level,
      // not mock Firebase internal modules.
      //
      // See test/api/members.test.ts for examples of mocking AuthService
      // at the service interface level.
    });
  });

  describe("verifyAdmin", () => {
    it.skip("Admin verification tests require Firebase Auth integration", () => {
      // Mock AuthService interface in route tests, not Firebase internals
    });
  });

  describe("verifyOwnerOrAdmin", () => {
    it.skip("Owner/admin verification tests require Firebase Auth integration", () => {
      // Mock AuthService interface in route tests, not Firebase internals
    });
  });
});
