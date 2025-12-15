import { describe, expect, it } from "bun:test";
import {
  ForbiddenError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { updateClaims } from "./update-claims.js";

/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */

/**
 * Service-layer tests for updateClaims function.
 * Tests input validation logic without mocking Firebase internals.
 *
 * Tests that require Firebase Auth integration are handled at the route level
 * where the service interface is mocked (see update-claims.test.ts in routes/).
 */

describe("updateClaims service - Input Validation", () => {
  const mockLogger: Logger = {
    log: () => {
      // Empty mock
    },
    info: () => {
      // Empty mock
    },
    warn: () => {
      // Empty mock
    },
    error: () => {
      // Empty mock
    },
    debug: () => {
      // Empty mock
    },
  };

  describe("Validation", () => {
    it("should throw ValidationError for empty UID", async () => {
      await expect(
        updateClaims({
          uid: "",
          claims: { admin: true },
          requestingAdminUid: "test-admin-uid",
          logger: mockLogger,
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        updateClaims({
          uid: "",
          claims: { admin: true },
          requestingAdminUid: "test-admin-uid",
          logger: mockLogger,
        }),
      ).rejects.toThrow("UID is required");
    });
  });

  describe("Self-modification prevention", () => {
    it("should throw ForbiddenError when admin tries to grant self admin claim", async () => {
      await expect(
        updateClaims({
          uid: "same-uid",
          claims: { admin: true },
          requestingAdminUid: "same-uid",
          logger: mockLogger,
        }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        updateClaims({
          uid: "same-uid",
          claims: { admin: true },
          requestingAdminUid: "same-uid",
          logger: mockLogger,
        }),
      ).rejects.toThrow("Cannot modify your own admin privileges");
    });

    it("should throw ForbiddenError when admin tries to revoke self admin claim", async () => {
      await expect(
        updateClaims({
          uid: "same-uid",
          claims: { admin: false },
          requestingAdminUid: "same-uid",
          logger: mockLogger,
        }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        updateClaims({
          uid: "same-uid",
          claims: { admin: false },
          requestingAdminUid: "same-uid",
          logger: mockLogger,
        }),
      ).rejects.toThrow("Cannot modify your own admin privileges");
    });

    it("should allow admin to modify other users admin claim", async () => {
      // This test verifies the logic doesn't block all claim updates
      // It will fail at Firebase Auth level (no emulator), but that's expected
      // The important thing is it doesn't throw ForbiddenError for self-modification

      try {
        await updateClaims({
          uid: "other-user-uid",
          claims: { admin: true },
          requestingAdminUid: "admin-uid",
          logger: mockLogger,
        });
      } catch (error) {
        // Should fail at Firebase Auth, not self-modification check
        expect(error).not.toBeInstanceOf(ForbiddenError);
      }
    });
  });

  describe("Firebase Auth Integration", () => {
    it.skip("Claim preservation tests require Firebase Auth emulator", () => {
      // These tests should be run as integration tests with emulators:
      // - Verify other claims (doula, editor) are preserved when updating admin
      // - Verify setCustomUserClaims is called with merged claims
      // - Verify claims can be removed by setting to false
      //
      // See route tests (update-claims.test.ts) for HTTP contract testing
      // with mocked service interface.
    });

    it.skip("Firebase error handling tests require Firebase Auth emulator", () => {
      // These tests require actual Firebase Auth to verify error codes:
      // - auth/user-not-found error handling
      // - auth/invalid-uid error handling
      // - Unexpected Firebase Auth error logging
      //
      // The route tests verify these errors are properly mapped to HTTP responses.
    });
  });
});
