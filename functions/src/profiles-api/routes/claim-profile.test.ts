import { describe, expect, it, mock } from "bun:test";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { createProfilesTestPlugin } from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /:slug/claim (claim profile).
 * Served at /api/profiles/:slug/claim via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 */
describe("POST /:slug/claim (claim profile)", () => {
  interface SetupOptions {
    slug?: string;
    authToken?: string | null;
    profileExists?: boolean;
    profileHasData?: boolean;
    profileData?: Record<string, unknown>;
    authUpdateFails?: boolean;
    importDeleteFails?: boolean;
    mailerliteApiKey?: string | null;
    emailSendFails?: boolean;
  }

  const createMockDocumentSnapshot = (
    exists: boolean,
    data?: unknown,
  ): DocumentSnapshot =>
    ({
      exists,
      id: "test-document",
      data: () => data,
    }) as DocumentSnapshot;

  function setup({
    slug = "test-user",
    authToken = "valid-token",
    profileExists = true,
    profileHasData = true,
    profileData = {
      name: "Test User",
      email: "test@example.com",
      subscriptionStart: Timestamp.now(),
      lastPayment: Timestamp.now(),
      nextPayment: Timestamp.now(),
    },
    authUpdateFails = false,
    importDeleteFails = false,
    mailerliteApiKey,
    emailSendFails = false,
  }: SetupOptions = {}) {
    // Set environment variable if specified
    if (mailerliteApiKey === null) {
      delete process.env["MAILERLITE_API_KEY"];
    } else if (mailerliteApiKey !== undefined) {
      process.env["MAILERLITE_API_KEY"] = mailerliteApiKey;
    }

    const mockGetImportDocument = mock(() => {
      if (!profileExists) {
        return Promise.resolve(createMockDocumentSnapshot(false));
      }
      if (!profileHasData) {
        return Promise.resolve(createMockDocumentSnapshot(true, undefined));
      }
      return Promise.resolve(createMockDocumentSnapshot(true, profileData));
    });

    const mockWriteMemberDocument = mock(() => Promise.resolve());

    const mockDeleteImportDocument = mock(() => {
      if (importDeleteFails) {
        return Promise.reject(new Error("Delete failed"));
      }
      return Promise.resolve();
    });

    const mockUpdateDisplayName = mock(() => {
      if (authUpdateFails) {
        return Promise.reject(new Error("Auth update failed"));
      }
      return Promise.resolve();
    });

    const mockSendEmail = mock(() => {
      if (emailSendFails) {
        return Promise.reject(new Error("Email send failed"));
      }
      return Promise.resolve();
    });

    const testApp = createProfilesTestPlugin({
      claimProfileFirestoreService: {
        getImportDocument: mockGetImportDocument,
        writeMemberDocument: mockWriteMemberDocument,
        deleteImportDocument: mockDeleteImportDocument,
      },
      authUpdateService: {
        updateDisplayName: mockUpdateDisplayName,
      },
      emailService: {
        sendEmail: mockSendEmail,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${slug}/claim`, {
      method: "POST",
      headers,
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const { testApp, request } = setup({ authToken: "invalid-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });

    it("should return 401 when token is expired", async () => {
      const { testApp, request } = setup({ authToken: "expired-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("session has expired");
    });
  });

  describe("Email verification", () => {
    it("should return 428 when email is not verified", async () => {
      const { testApp, request } = setup({
        authToken: "unverified-email-token",
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(428);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("verified email");
    });

    it("should return 400 when email is missing from token", async () => {
      const { testApp, request } = setup({ authToken: "no-email-token" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("email address");
    });
  });

  describe("Business logic", () => {
    it("should successfully claim a profile with valid data", async () => {
      const { testApp, request } = setup();

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });

    it("should return no_profile_to_claim when import document doesn't exist", async () => {
      const { testApp, request } = setup({ profileExists: false });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("no_profile_to_claim");
    });

    it("should handle race condition gracefully when import doc is deleted mid-claim", async () => {
      // Simulates a race condition where another process deletes the import
      // document between the time the user clicks "claim" and when the
      // server processes the request. This is idempotent - returns success
      // with no_profile_to_claim status instead of crashing.
      const { testApp, request } = setup({ profileExists: false });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("no_profile_to_claim");
    });

    it("should return error when profile document exists but has no data", async () => {
      const { testApp, request } = setup({
        profileExists: true,
        profileHasData: false,
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("No profile data found");
    });

    it("should return error when profile is missing subscriptionStart", async () => {
      const { testApp, request } = setup({
        profileData: {
          name: "Test User",
          email: "test@example.com",
        },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("subscription information");
      expect(body.error).toContain("MISSING_SUBSCRIPTION_START");
    });

    it("should return error when profile is missing name", async () => {
      const { testApp, request } = setup({
        profileData: {
          name: "",
          email: "test@example.com",
          subscriptionStart: Timestamp.now(),
        },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("missing a required name");
      expect(body.error).toContain("MISSING_NAME");
    });

    it("should return error when Firestore write fails", async () => {
      const mockWriteFails = mock(() =>
        Promise.reject(new Error("Firestore write failed")),
      );

      const testApp = createProfilesTestPlugin({
        claimProfileFirestoreService: {
          getImportDocument: mock(() =>
            Promise.resolve(
              createMockDocumentSnapshot(true, {
                name: "Test User",
                email: "test@example.com",
                subscriptionStart: Timestamp.now(),
              }),
            ),
          ),
          writeMemberDocument: mockWriteFails,
        },
      });

      const request = new Request("http://localhost/test-user/claim", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Failed to save profile data");
    });

    it("should succeed even when auth displayName update fails (non-critical)", async () => {
      const { testApp, request } = setup({ authUpdateFails: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });

    it("should succeed even when import deletion fails (non-critical)", async () => {
      const { testApp, request } = setup({ importDeleteFails: true });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });

    it("should calculate membership expiration correctly", async () => {
      const subscriptionDate = new Date("2024-03-15");
      const { testApp, request } = setup({
        profileData: {
          name: "Test User",
          email: "test@example.com",
          subscriptionStart: Timestamp.fromDate(subscriptionDate),
        },
      });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        status?: string;
        data?: {
          nextPayment?: { seconds?: number; nanoseconds?: number };
        };
      };
      expect(body.status).toBe("success");
      expect(body.data?.nextPayment).toBeDefined();
      expect(body.data?.nextPayment?.seconds).toBeTypeOf("number");
    });

    it("should succeed with MailerLite integration when MAILERLITE_API_KEY is set", async () => {
      const { testApp, request } = setup({ mailerliteApiKey: "test-api-key" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });

    it("should succeed and send notification email when MailerLite fails", async () => {
      const { testApp, request } = setup({ mailerliteApiKey: "test-api-key" });

      const response = (await testApp.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(body.status).toBe("success");
    });
  });
});
