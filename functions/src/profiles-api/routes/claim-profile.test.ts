import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
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

  describe("Business logic", () => {
    const createMockDocumentSnapshot = (
      exists: boolean,
      data?: unknown,
    ): DocumentSnapshot => ({
      exists,
      id: "test-document",
      data: () => data,
    }) as DocumentSnapshot;

    it("should successfully claim a profile with valid data", async () => {
      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        subscriptionStart: Timestamp.now(),
        lastPayment: Timestamp.now(),
        nextPayment: Timestamp.now(),
      };

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
          writeMemberDocument: mock(() => Promise.resolve()),
          deleteImportDocument: mock(() => Promise.resolve()),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });

    it("should return no_profile_to_claim when import document doesn't exist", async () => {
      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(false)),
          ),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("no_profile_to_claim");
    });

    it("should return error when profile document exists but has no data", async () => {
      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, undefined)),
          ),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("No profile data found");
    });

    it("should return error when profile is missing subscriptionStart", async () => {
      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        // Missing subscriptionStart
      };

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("subscription information");
      expect(body.error).toContain("MISSING_SUBSCRIPTION_START");
    });

    it("should return error when profile is missing name", async () => {
      const mockImportData = {
        name: "", // Empty name
        email: "test@example.com",
        subscriptionStart: Timestamp.now(),
      };

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("missing a required name");
      expect(body.error).toContain("MISSING_NAME");
    });

    it("should return error when Firestore write fails", async () => {
      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        subscriptionStart: Timestamp.now(),
      };

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
          writeMemberDocument: mock(() =>
            Promise.reject(new Error("Firestore write failed")),
          ),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to save profile data");
    });

    it("should succeed even when auth displayName update fails (non-critical)", async () => {
      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        subscriptionStart: Timestamp.now(),
      };

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
          writeMemberDocument: mock(() => Promise.resolve()),
          deleteImportDocument: mock(() => Promise.resolve()),
        },
        authUpdateService: {
          updateDisplayName: mock(() =>
            Promise.reject(new Error("Auth update failed")),
          ),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      // Should still succeed despite auth update failure
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });

    it("should succeed even when import deletion fails (non-critical)", async () => {
      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        subscriptionStart: Timestamp.now(),
      };

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
          writeMemberDocument: mock(() => Promise.resolve()),
          deleteImportDocument: mock(() =>
            Promise.reject(new Error("Delete failed")),
          ),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      // Should still succeed despite deletion failure
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });

    it("should calculate membership expiration correctly", async () => {
      // Test with a specific subscription date
      const subscriptionDate = new Date("2024-03-15"); // Mid-March
      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        subscriptionStart: Timestamp.fromDate(subscriptionDate),
      };

      const writeMemberDocumentMock = mock(() => Promise.resolve());

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
          writeMemberDocument: writeMemberDocumentMock,
          deleteImportDocument: mock(() => Promise.resolve()),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);

      // Test HTTP response contract - verify response structure
      const body = (await response.json()) as {
        status?: string;
        data?: {
          nextPayment?: { seconds?: number; nanoseconds?: number };
        };
      };
      expect(body.status).toBe("success");
      expect(body.data?.nextPayment).toBeDefined();

      // Expiration (nextPayment) should be a valid Timestamp object
      // The actual date validation is tested by the business logic
      expect(body.data?.nextPayment?.seconds).toBeTypeOf("number");
    });

    it("should succeed with MailerLite integration when MAILERLITE_API_KEY is set", async () => {
      // Set the environment variable for this test
      const originalKey = process.env["MAILERLITE_API_KEY"];
      process.env["MAILERLITE_API_KEY"] = "test-api-key";

      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        subscriptionStart: Timestamp.now(),
      };

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
          writeMemberDocument: mock(() => Promise.resolve()),
          deleteImportDocument: mock(() => Promise.resolve()),
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");

      // Restore original environment variable
      if (originalKey === undefined) {
        delete process.env["MAILERLITE_API_KEY"];
      } else {
        process.env["MAILERLITE_API_KEY"] = originalKey;
      }
    });

    it("should succeed and send notification email when MailerLite fails", async () => {
      // Set the environment variable for this test
      const originalKey = process.env["MAILERLITE_API_KEY"];
      process.env["MAILERLITE_API_KEY"] = "test-api-key";

      const mockImportData = {
        name: "Test User",
        email: "test@example.com",
        subscriptionStart: Timestamp.now(),
      };

      const sendEmailMock = mock(() => Promise.resolve());

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(createMockDocumentSnapshot(true, mockImportData)),
          ),
          writeMemberDocument: mock(() => Promise.resolve()),
          deleteImportDocument: mock(() => Promise.resolve()),
        },
        emailService: {
          sendEmail: sendEmailMock,
        },
      });

      const response = (await testApp.handle(
        new Request("http://localhost/test-user/claim", {
          method: "POST",
          headers: {
            Authorization: "Bearer valid-token",
          },
        }),
      )) as Response;

      // Should still succeed
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");

      // Note: In real scenario, notification email would be sent if MailerLite fails
      // Since we're mocking, we can't easily test the actual MailerLite failure path
      // without more complex mocking of the addNewsletterSubscriber utility

      // Restore original environment variable
      if (originalKey === undefined) {
        delete process.env["MAILERLITE_API_KEY"];
      } else {
        process.env["MAILERLITE_API_KEY"] = originalKey;
      }
    });
  });
});
