import { describe, expect, it, mock } from "bun:test";
import type { ContactFormBody } from "../schemas/form-response-schemas.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { createContactUsFormTestPlugin } from "../test-utils/create-forms-test-plugins.js";

/**
 * Tests for POST /contact-us route.
 *
 * Uses plugin factory with mocked services.
 */
describe("POST /contact-us", () => {
  interface SetupOptions {
    // Request body - form data (Partial to allow omitting fields in tests)
    body?: Partial<ContactFormBody>;

    // Environment
    recaptchaSecretKey?: string | null;

    // Scenario flags
    recaptchaVerificationFails?: boolean;
    recaptchaScoreTooLow?: boolean;
    emailSendFails?: boolean;
    firestoreSaveFails?: boolean;
  }

  function setup({
    body = {
      contactName: "John Doe",
      email: "john@example.com",
      message: "I need help with something",
      recaptchaToken: "valid-token",
    },
    recaptchaSecretKey = "test-recaptcha-key",
    recaptchaVerificationFails = false,
    recaptchaScoreTooLow = false,
    emailSendFails = false,
    firestoreSaveFails = false,
  }: SetupOptions = {}) {
    // Set environment variable for this test
    if (recaptchaSecretKey === null) {
      delete process.env["RECAPTCHA_SECRET_KEY"];
    } else {
      process.env["RECAPTCHA_SECRET_KEY"] = recaptchaSecretKey;
    }

    // Configure mocks based on scenario flags
    const mockRecaptchaService: Partial<RecaptchaService> = {
      verifyToken: mock(() => {
        if (recaptchaVerificationFails) {
          return Promise.resolve({
            success: false,
            score: 0,
            error: "reCAPTCHA verification failed",
          });
        }
        if (recaptchaScoreTooLow) {
          return Promise.resolve({
            success: true,
            score: 0,
          });
        }
        return Promise.resolve({
          success: true,
          score: 0.9,
        });
      }),
    };

    const mockSaveContactForm = mock(() => {
      if (firestoreSaveFails) {
        return Promise.reject(
          new Error(
            "Failed to save contact form to Firestore after email was sent: Quota exceeded",
          ),
        );
      }
      return Promise.resolve();
    });

    const mockSendEmail = mock(() => {
      if (emailSendFails) {
        return Promise.reject(new Error("Mailgun timeout"));
      }
      return Promise.resolve();
    });

    // Create plugin with mocked services
    const plugin = createContactUsFormTestPlugin({
      formStorageService: { saveContactForm: mockSaveContactForm },
      emailService: { sendEmail: mockSendEmail },
      recaptchaService: mockRecaptchaService,
    });

    // Build request from parameters
    const request = new Request("http://localhost/contact-us", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return { plugin, request };
  }

  describe("Validation", () => {
    it("should return 422 when contactName is missing", async () => {
      const { plugin, request } = setup({
        body: {
          email: "test@example.com",
          message: "test",
          recaptchaToken: "token",
          // Missing contactName
        },
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when email is invalid", async () => {
      const { plugin, request } = setup({
        body: {
          contactName: "Test User",
          email: "invalid-email",
          message: "test",
          recaptchaToken: "token",
        },
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when message is too long", async () => {
      const { plugin, request } = setup({
        body: {
          contactName: "Test User",
          email: "test@example.com",
          message: "a".repeat(5001), // Exceeds 5000 char limit
          recaptchaToken: "token",
        },
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Configuration Errors", () => {
    it("should return 500 when RECAPTCHA_SECRET_KEY is not configured", async () => {
      const { plugin, request } = setup({
        recaptchaSecretKey: null,
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Server configuration error");
    });
  });

  describe("reCAPTCHA Verification", () => {
    it("should return 400 when reCAPTCHA token is missing", async () => {
      const { plugin, request } = setup({
        body: {
          contactName: "Test User",
          email: "test@example.com",
          message: "test message",
          // Missing recaptchaToken
        },
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing reCAPTCHA token");
    });

    it("should return 400 when reCAPTCHA verification fails", async () => {
      const { plugin, request } = setup({
        recaptchaVerificationFails: true,
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("reCAPTCHA verification failed");
    });

    it("should return 400 when reCAPTCHA score is below threshold", async () => {
      const { plugin, request } = setup({
        recaptchaScoreTooLow: true,
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("reCAPTCHA verification failed");
    });
  });

  describe("Successful Submission", () => {
    it("should save form and send email on successful submission", async () => {
      const { plugin, request } = setup();

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        emailSent?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.emailSent).toBe(true);
    });
  });

  describe("Email Failure Handling", () => {
    it("should save form and return warning when email send fails", async () => {
      const { plugin, request } = setup({
        emailSendFails: true,
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        emailSent?: boolean;
        warning?: string;
      };
      expect(body.success).toBe(true);
      expect(body.emailSent).toBe(false);
      expect(body.warning).toBe(
        "Form saved but notification email failed to send",
      );
    });
  });

  describe("Firestore Failure Handling", () => {
    it("should return 500 when Firestore save fails", async () => {
      const { plugin, request } = setup({
        firestoreSaveFails: true,
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Internal server error");
    });
  });
});
