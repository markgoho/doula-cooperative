import { beforeEach, describe, expect, it } from "bun:test";
import { createProfilesTestPlugin } from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /me/claim (claim profile).
 * Served at /api/profiles/me/claim via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /:slug/claim (claim profile)", () => {
  const testApp = createProfilesTestPlugin();

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });

    it("should return 401 when token is expired", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer expired-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("session has expired");
    });
  });

  describe("Email verification", () => {
    it("should return 428 when email is not verified", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer unverified-email-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(428);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("verified email");
    });

    it("should return 400 when email is missing from token", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer no-email-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("email address");
    });
  });

  // TODO: Full claim profile testing requires Firestore emulator
  // The claimProfileLogic function directly uses getFirestore(), getAuth(), etc.
  // and doesn't use the injected profileMemberService, so we can't mock Firestore
  // operations in unit tests without running emulators.
  //
  // Options:
  // 1. Refactor claimProfileLogic to use dependency injection for Firestore/Auth
  // 2. Write integration tests with emulator
  // 3. Skip unit tests for this route's business logic (only test auth above)
  //
  // The authentication tests above verify the HTTP contract for auth scenarios.
});
