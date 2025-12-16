import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { AuthError, ForbiddenError } from "../shared-api/errors/http-error.js";

/**
 * Creates a mock verifyAuthToken function for user authentication tests.
 * This is for general user auth (no admin check).
 *
 * @returns Mock function that resolves for "Bearer valid-token", rejects with 401 otherwise
 */
export function createMockVerifyAuthToken() {
  return mock(
    (authorizationHeader: string | undefined): Promise<DecodedIdToken> => {
      if (!authorizationHeader) {
        return Promise.reject(new AuthError("Missing Authorization header"));
      }

      if (authorizationHeader === "Bearer valid-token") {
        return Promise.resolve({
          uid: "test-user-123",
          email: "user@example.com",
          email_verified: true,
        } as DecodedIdToken);
      }

      if (authorizationHeader === "Bearer another-user-token") {
        return Promise.resolve({
          uid: "another-user-456",
          email: "another@example.com",
        } as DecodedIdToken);
      }

      if (authorizationHeader === "Bearer admin-token") {
        return Promise.resolve({
          uid: "admin-user",
          email: "admin@example.com",
          admin: true,
        } as unknown as DecodedIdToken);
      }

      if (authorizationHeader === "Bearer expired-token") {
        return Promise.reject(
          new AuthError("Your session has expired. Please sign in again."),
        );
      }

      if (authorizationHeader === "Bearer unverified-email-token") {
        return Promise.resolve({
          uid: "unverified-user-123",
          email: "unverified@example.com",
          email_verified: false,
        } as DecodedIdToken);
      }

      if (authorizationHeader === "Bearer no-email-token") {
        return Promise.resolve({
          uid: "no-email-user-123",
          // No email field
        } as DecodedIdToken);
      }

      return Promise.reject(new AuthError("Invalid authentication token"));
    },
  );
}

/**
 * Creates a mock verifyAdmin function that follows the standard test pattern.
 *
 * @returns Mock function that resolves for "Bearer admin-token", rejects with 401/403 otherwise
 */
export function createMockVerifyAdmin() {
  return mock(
    (authorizationHeader: string | undefined): Promise<DecodedIdToken> => {
      if (!authorizationHeader) {
        return Promise.reject(new AuthError("Missing Authorization header"));
      }

      if (authorizationHeader === "Bearer admin-token") {
        return Promise.resolve({
          uid: "admin-user",
          email: "admin@example.com",
          admin: true,
        } as unknown as DecodedIdToken);
      }

      if (authorizationHeader === "Bearer non-admin-token") {
        return Promise.reject(new ForbiddenError("Admin privileges required"));
      }

      return Promise.reject(new AuthError("Invalid authentication token"));
    },
  );
}

/**
 * Creates a mock verifyOwnerOrAdmin function for member access tests.
 *
 * @returns Mock function that handles owner/admin authorization logic
 */
export function createMockVerifyOwnerOrAdmin() {
  return mock(
    (
      authorizationHeader: string | undefined,
      memberId: string,
    ): Promise<DecodedIdToken> => {
      if (!authorizationHeader) {
        return Promise.reject(new AuthError("Missing Authorization header"));
      }

      if (
        authorizationHeader === "Bearer valid-owner-token" &&
        memberId === "test-member-id"
      ) {
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
        return Promise.reject(
          new ForbiddenError("You can only access your own data"),
        );
      }

      return Promise.reject(new AuthError("Invalid authentication token"));
    },
  );
}
