import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getAuth } from "firebase-admin/auth";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { initializeTest } from "../../test-utils/test-setup.js";
import { updateClaims } from "./update-claims.js";

/**
 * Service-layer tests for updateClaims function.
 * These tests verify the business logic and Firebase Auth integration.
 */

const test = initializeTest();

describe("updateClaims service", () => {
  const mockLogger: Logger = {
    log: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };

  const testAdminUid = "test-admin-uid";
  let testUserUid: string;

  beforeEach(async () => {
    // Create a test user with existing claims
    const auth = getAuth();
    const userRecord = await auth.createUser({
      email: `test-${Date.now()}@example.com`,
    });
    testUserUid = userRecord.uid;

    // Set initial claims (simulating a user with doula claim)
    await auth.setCustomUserClaims(testUserUid, {
      doula: true,
      editor: true,
    });
  });

  afterEach(async () => {
    // Clean up test user
    const auth = getAuth();
    try {
      await auth.deleteUser(testUserUid);
    } catch {
      // User might already be deleted
    }
  });

  describe("Validation", () => {
    it("should throw ValidationError for empty UID", async () => {
      try {
        await updateClaims({
          uid: "",
          claims: { admin: true },
          requestingAdminUid: testAdminUid,
          logger: mockLogger,
        });
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.message).toBe("UID is required");
        }
      }
    });

    it("should throw NotFoundError for non-existent user", async () => {
      try {
        await updateClaims({
          uid: "non-existent-uid-12345",
          claims: { admin: true },
          requestingAdminUid: testAdminUid,
          logger: mockLogger,
        });
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
        if (error instanceof NotFoundError) {
          expect(error.message).toContain("not found");
        }
      }
    });

    it("should throw ValidationError for invalid UID format", async () => {
      try {
        await updateClaims({
          uid: "invalid uid with spaces",
          claims: { admin: true },
          requestingAdminUid: testAdminUid,
          logger: mockLogger,
        });
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.message).toContain("Invalid user ID format");
        }
      }
    });
  });

  describe("Self-modification prevention", () => {
    it("should throw ForbiddenError when admin tries to grant self admin claim", async () => {
      try {
        await updateClaims({
          uid: testUserUid,
          claims: { admin: true },
          requestingAdminUid: testUserUid,
          logger: mockLogger,
        });
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        if (error instanceof ForbiddenError) {
          expect(error.message).toContain("Cannot modify your own admin privileges");
        }
      }
    });

    it("should throw ForbiddenError when admin tries to revoke self admin claim", async () => {
      try {
        await updateClaims({
          uid: testUserUid,
          claims: { admin: false },
          requestingAdminUid: testUserUid,
          logger: mockLogger,
        });
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        if (error instanceof ForbiddenError) {
          expect(error.message).toContain("Cannot modify your own admin privileges");
        }
      }
    });
  });

  describe("Claim preservation", () => {
    it("should preserve existing claims when granting admin claim", async () => {
      await updateClaims({
        uid: testUserUid,
        claims: { admin: true },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const auth = getAuth();
      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["admin"]).toBe(true);
      expect(claims["doula"]).toBe(true);
      expect(claims["editor"]).toBe(true);
    });

    it("should preserve existing claims when revoking admin claim", async () => {
      // First grant admin claim
      await updateClaims({
        uid: testUserUid,
        claims: { admin: true },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      // Then revoke it
      await updateClaims({
        uid: testUserUid,
        claims: { admin: false },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const auth = getAuth();
      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["admin"]).toBeUndefined();
      expect(claims["doula"]).toBe(true);
      expect(claims["editor"]).toBe(true);
    });

    it("should handle removing a claim that doesn't exist", async () => {
      await updateClaims({
        uid: testUserUid,
        claims: { admin: false },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const auth = getAuth();
      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["admin"]).toBeUndefined();
      expect(claims["doula"]).toBe(true);
      expect(claims["editor"]).toBe(true);
    });
  });

  describe("Claim operations", () => {
    it("should successfully grant admin claim", async () => {
      await updateClaims({
        uid: testUserUid,
        claims: { admin: true },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const auth = getAuth();
      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["admin"]).toBe(true);
    });

    it("should successfully revoke admin claim", async () => {
      // First grant admin claim
      const auth = getAuth();
      await auth.setCustomUserClaims(testUserUid, {
        doula: true,
        editor: true,
        admin: true,
      });

      // Then revoke it
      await updateClaims({
        uid: testUserUid,
        claims: { admin: false },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["admin"]).toBeUndefined();
    });

    it("should handle empty claims object as no-op", async () => {
      await updateClaims({
        uid: testUserUid,
        claims: {},
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const auth = getAuth();
      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["doula"]).toBe(true);
      expect(claims["editor"]).toBe(true);
    });
  });

  describe("Falsy value handling", () => {
    it("should remove claim when set to false", async () => {
      await updateClaims({
        uid: testUserUid,
        claims: { admin: false },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const auth = getAuth();
      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["admin"]).toBeUndefined();
    });

    it("should remove claim when set to undefined", async () => {
      await updateClaims({
        uid: testUserUid,
        claims: { admin: undefined },
        requestingAdminUid: testAdminUid,
        logger: mockLogger,
      });

      const auth = getAuth();
      const user = await auth.getUser(testUserUid);
      const claims = user.customClaims ?? {};

      expect(claims["admin"]).toBeUndefined();
    });
  });
});
