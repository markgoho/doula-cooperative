import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createContactUsFormTestPlugin } from "../test-utils/create-forms-test-plugins.js";

/**
 * Tests for POST /contact-us.
 *
 * Uses plugin factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /contact-us", () => {
  const validContactFormData = {
    contactName: "John Doe",
    email: "john@example.com",
    message: "I need help with something",
    recaptchaToken: "valid-token",
  };

  describe("Validation", () => {
    it("should return 422 when contactName is missing", async () => {
      const plugin = createContactUsFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            message: "test",
            recaptchaToken: "token",
            // Missing contactName
          }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when email is invalid", async () => {
      const plugin = createContactUsFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: "Test User",
            email: "invalid-email",
            message: "test",
            recaptchaToken: "token",
          }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when message is too long", async () => {
      const plugin = createContactUsFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: "Test User",
            email: "test@example.com",
            message: "a".repeat(5001), // Exceeds 5000 char limit
            recaptchaToken: "token",
          }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Configuration Errors", () => {
    it("should return 500 when RECAPTCHA_SECRET_KEY is not configured", async () => {
      const plugin = createContactUsFormTestPlugin();

      // Clear environment variable
      const originalRecaptchaKey = process.env["RECAPTCHA_SECRET_KEY"];
      delete process.env["RECAPTCHA_SECRET_KEY"];

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validContactFormData),
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Server configuration error");

      // Restore environment variable
      if (originalRecaptchaKey) {
        process.env["RECAPTCHA_SECRET_KEY"] = originalRecaptchaKey;
      }
    });
  });

  describe("reCAPTCHA Verification", () => {
    beforeEach(() => {
      process.env["RECAPTCHA_SECRET_KEY"] = "test-recaptcha-key";
    });

    it("should return 400 when reCAPTCHA token is missing", async () => {
      const plugin = createContactUsFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: "Test User",
            email: "test@example.com",
            message: "test message",
            // Missing recaptchaToken
          }),
        }),
      )) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing reCAPTCHA token");
    });

    it("should return 400 when reCAPTCHA verification fails", async () => {
      const mockRecaptchaService = {
        verifyToken: mock(() =>
          Promise.resolve({
            success: false,
            score: 0,
            error: "reCAPTCHA verification failed",
          }),
        ),
      };

      const plugin = createContactUsFormTestPlugin({
        recaptchaService: mockRecaptchaService,
      });

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validContactFormData),
        }),
      )) as Response;

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("reCAPTCHA verification failed");
    });
  });

  describe("Successful Submission", () => {
    beforeEach(() => {
      process.env["RECAPTCHA_SECRET_KEY"] = "test-recaptcha-key";
    });

    it("should save form and send email on successful submission", async () => {
      const mockSaveContactForm = mock(() => Promise.resolve());
      const mockSendEmail = mock(() => Promise.resolve());

      const plugin = createContactUsFormTestPlugin({
        formStorageService: { saveContactForm: mockSaveContactForm },
        emailService: { sendEmail: mockSendEmail },
      });

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validContactFormData),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        emailSent?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.emailSent).toBe(true);
      expect(mockSaveContactForm).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe("Email Failure Handling", () => {
    beforeEach(() => {
      process.env["RECAPTCHA_SECRET_KEY"] = "test-recaptcha-key";
    });

    it("should save form and return warning when email send fails", async () => {
      const mockSaveContactForm = mock(() => Promise.resolve());
      const mockSendEmail = mock(() =>
        Promise.reject(new Error("Mailgun timeout")),
      );

      const plugin = createContactUsFormTestPlugin({
        formStorageService: { saveContactForm: mockSaveContactForm },
        emailService: { sendEmail: mockSendEmail },
      });

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validContactFormData),
        }),
      )) as Response;

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
      // CRITICAL: Form should still be saved even when email fails
      expect(mockSaveContactForm).toHaveBeenCalledTimes(1);
      expect(mockSaveContactForm).toHaveBeenCalledWith({
        data: {
          contactName: validContactFormData.contactName,
          email: validContactFormData.email,
          message: validContactFormData.message,
        },
        recaptchaScore: 0.9,
        emailSent: false, // CRITICAL: Must be false
      });
    });
  });

  describe("Firestore Failure Handling", () => {
    beforeEach(() => {
      process.env["RECAPTCHA_SECRET_KEY"] = "test-recaptcha-key";
    });

    it("should return 500 when Firestore save fails", async () => {
      const mockSaveContactForm = mock(() =>
        Promise.reject(
          new Error("Failed to save contact form to Firestore after email was sent: Quota exceeded"),
        ),
      );

      const plugin = createContactUsFormTestPlugin({
        formStorageService: { saveContactForm: mockSaveContactForm },
      });

      const response = (await plugin.handle(
        new Request("http://localhost/contact-us", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validContactFormData),
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Internal server error");
    });
  });
});
