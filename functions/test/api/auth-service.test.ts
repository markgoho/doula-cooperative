import { describe, expect, it } from "bun:test";
import { AuthService } from "../../src/api/services/auth-service.js";
import { AuthError, ForbiddenError } from "../../src/api/errors/http-error.js";

/**
 * Tests for AuthService (decoupled from Elysia Context).
 *
 * These tests run WITHOUT Firebase emulators for basic validation logic.
 * Tests marked with .skip() require Firebase Auth emulator for token verification.
 *
 * Run these tests with:
 *   bun test test/api/auth-service.test.ts
 */
describe("AuthService", () => {
  describe("verifyAuthToken - Input Validation", () => {
    it("should throw AuthError when authorization header is missing", async () => {
      try {
        await AuthService.verifyAuthToken(undefined);
        throw new Error("Should have thrown AuthError");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        if (error instanceof AuthError) {
          expect(error.message).toBe("Missing Authorization header");
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it("should throw AuthError for non-Bearer authorization schemes", async () => {
      try {
        await AuthService.verifyAuthToken("Basic dXNlcjpwYXNz");
        throw new Error("Should have thrown AuthError");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        if (error instanceof AuthError) {
          expect(error.message).toBe(
            "Authorization header must use Bearer scheme",
          );
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it("should throw AuthError for empty Bearer tokens", async () => {
      try {
        await AuthService.verifyAuthToken("Bearer ");
        throw new Error("Should have thrown AuthError");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        if (error instanceof AuthError) {
          expect(error.message).toBe("Missing auth token");
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it("should throw AuthError for whitespace-only tokens", async () => {
      try {
        await AuthService.verifyAuthToken("Bearer   ");
        throw new Error("Should have thrown AuthError");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        if (error instanceof AuthError) {
          expect(error.message).toBe("Missing auth token");
          expect(error.statusCode).toBe(401);
        }
      }
    });
  });

  describe("verifyAuthToken - Token Verification (requires emulator)", () => {
    it.skip("should throw AuthError for invalid tokens", async () => {
      // This test requires Firebase Auth emulator
      try {
        await AuthService.verifyAuthToken("Bearer invalid-token-12345");
        throw new Error("Should have thrown AuthError");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        if (error instanceof AuthError) {
          expect(error.message).toBe("Invalid or expired auth token");
          expect(error.statusCode).toBe(401);
        }
      }
    });

    it.skip("should accept valid Firebase Auth tokens", async () => {
      // This test requires Firebase Auth emulator
      const validToken = "VALID_TOKEN_FROM_EMULATOR";

      const decodedToken = await AuthService.verifyAuthToken(
        `Bearer ${validToken}`,
      );

      expect(decodedToken).toHaveProperty("uid");
    });
  });

  describe("verifyAdmin", () => {
    it("should throw AuthError when not authenticated", async () => {
      try {
        await AuthService.verifyAdmin(undefined);
        throw new Error("Should have thrown AuthError");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
      }
    });

    it.skip("should throw ForbiddenError for non-admin users", async () => {
      // This test requires Firebase Auth emulator and valid non-admin token
      const nonAdminToken = "VALID_NON_ADMIN_TOKEN";

      try {
        await AuthService.verifyAdmin(`Bearer ${nonAdminToken}`);
        throw new Error("Should have thrown ForbiddenError");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        if (error instanceof ForbiddenError) {
          expect(error.message).toBe("This endpoint requires admin privileges");
          expect(error.statusCode).toBe(403);
        }
      }
    });

    it.skip("should accept admin users", async () => {
      // This test requires Firebase Auth emulator and valid admin token
      const adminToken = "VALID_ADMIN_TOKEN";

      const decodedToken = await AuthService.verifyAdmin(
        `Bearer ${adminToken}`,
      );

      expect(decodedToken).toHaveProperty("uid");
      expect(decodedToken["admin"]).toBe(true);
    });
  });

  describe("verifyOwnerOrAdmin", () => {
    it("should throw AuthError when not authenticated", async () => {
      try {
        await AuthService.verifyOwnerOrAdmin(undefined, "user-123");
        throw new Error("Should have thrown AuthError");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
      }
    });

    it.skip("should allow users to access their own data", async () => {
      // This test requires Firebase Auth emulator and valid user token
      const userToken = "VALID_TOKEN_USER_123";

      const decodedToken = await AuthService.verifyOwnerOrAdmin(
        `Bearer ${userToken}`,
        "user-123",
      );

      expect(decodedToken.uid).toBe("user-123");
    });

    it.skip("should throw ForbiddenError when users access others' data", async () => {
      // This test requires Firebase Auth emulator and valid user token
      const userToken = "VALID_TOKEN_USER_123";

      try {
        await AuthService.verifyOwnerOrAdmin(`Bearer ${userToken}`, "user-456");
        throw new Error("Should have thrown ForbiddenError");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        if (error instanceof ForbiddenError) {
          expect(error.message).toBe("You can only access your own data");
          expect(error.statusCode).toBe(403);
        }
      }
    });

    it.skip("should allow admins to access any user data", async () => {
      // This test requires Firebase Auth emulator and valid admin token
      const adminToken = "VALID_ADMIN_TOKEN";

      const decodedToken = await AuthService.verifyOwnerOrAdmin(
        `Bearer ${adminToken}`,
        "user-456",
      );

      expect(decodedToken).toHaveProperty("uid");
      expect(decodedToken["admin"]).toBe(true);
    });
  });
});
