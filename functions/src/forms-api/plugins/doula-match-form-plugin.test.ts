import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createDoulaMatchFormTestPlugin } from "../test-utils/create-forms-test-plugins.js";

/**
 * Tests for POST /doula-match.
 *
 * Uses plugin factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("POST /doula-match", () => {
  const validMatchFormData = {
    name: "Jane Smith",
    phone: "555-1234",
    email: "jane@example.com",
    zipcode: "12345",
    estimatedDueDate: {
      month: "12",
      day: "25",
      year: "2024",
    },
    services: ["Birth Support", "Postpartum Care"],
    birthLocation: "Hospital ABC",
    otherInfo: "First time parent",
    insurance: ["Aetna"],
    recaptchaToken: "valid-token",
  };

  describe("Validation", () => {
    it("should return 422 when name is missing", async () => {
      const plugin = createDoulaMatchFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...validMatchFormData,
            name: undefined, // Missing name
          }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when email is invalid", async () => {
      const plugin = createDoulaMatchFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...validMatchFormData,
            email: "invalid-email",
          }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when zipcode is too short", async () => {
      const plugin = createDoulaMatchFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...validMatchFormData,
            zipcode: "123", // Too short
          }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when services array is missing", async () => {
      const plugin = createDoulaMatchFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...validMatchFormData,
            services: undefined,
          }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Configuration Errors", () => {
    it("should return 500 when RECAPTCHA_SECRET_KEY is not configured", async () => {
      const plugin = createDoulaMatchFormTestPlugin();

      // Clear environment variable
      const originalRecaptchaKey = process.env["RECAPTCHA_SECRET_KEY"];
      delete process.env["RECAPTCHA_SECRET_KEY"];

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validMatchFormData),
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
      const plugin = createDoulaMatchFormTestPlugin();

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...validMatchFormData,
            recaptchaToken: undefined,
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

      const plugin = createDoulaMatchFormTestPlugin({
        recaptchaService: mockRecaptchaService,
      });

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validMatchFormData),
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
      process.env["MAILGUN_API_KEY"] = "test-mailgun-key";
    });

    it("should save form and send email on successful submission", async () => {
      const mockSaveMatchRequest = mock(() => Promise.resolve());
      const mockSendEmail = mock(() => Promise.resolve());

      const plugin = createDoulaMatchFormTestPlugin({
        formStorageService: { saveMatchRequest: mockSaveMatchRequest },
        emailService: { sendEmail: mockSendEmail },
      });

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validMatchFormData),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        emailSent?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.emailSent).toBe(true);
      expect(mockSaveMatchRequest).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe("Email Failure Handling", () => {
    beforeEach(() => {
      process.env["RECAPTCHA_SECRET_KEY"] = "test-recaptcha-key";
      process.env["MAILGUN_API_KEY"] = "test-mailgun-key";
    });

    it("should save form and return warning when email send fails", async () => {
      const mockSaveMatchRequest = mock(() => Promise.resolve());
      const mockSendEmail = mock(() =>
        Promise.reject(new Error("Mailgun timeout")),
      );

      const plugin = createDoulaMatchFormTestPlugin({
        formStorageService: { saveMatchRequest: mockSaveMatchRequest },
        emailService: { sendEmail: mockSendEmail },
      });

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validMatchFormData),
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
      expect(mockSaveMatchRequest).toHaveBeenCalledTimes(1);
      expect(mockSaveMatchRequest).toHaveBeenCalledWith({
        data: {
          name: validMatchFormData.name,
          phone: validMatchFormData.phone,
          email: validMatchFormData.email,
          zipcode: validMatchFormData.zipcode,
          estimatedDueDate: validMatchFormData.estimatedDueDate,
          services: validMatchFormData.services,
          birthLocation: validMatchFormData.birthLocation,
          otherInfo: validMatchFormData.otherInfo,
          insurance: validMatchFormData.insurance,
        },
        recaptchaScore: 0.9,
        emailSent: false, // CRITICAL: Must be false
      });
    });
  });

  describe("Firestore Failure Handling", () => {
    beforeEach(() => {
      process.env["RECAPTCHA_SECRET_KEY"] = "test-recaptcha-key";
      process.env["MAILGUN_API_KEY"] = "test-mailgun-key";
    });

    it("should return 500 when Firestore save fails", async () => {
      const mockSaveMatchRequest = mock(() =>
        Promise.reject(
          new Error("Failed to save doula match request to Firestore after email was sent: Quota exceeded"),
        ),
      );

      const plugin = createDoulaMatchFormTestPlugin({
        formStorageService: { saveMatchRequest: mockSaveMatchRequest },
      });

      const response = (await plugin.handle(
        new Request("http://localhost/doula-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validMatchFormData),
        }),
      )) as Response;

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Internal server error");
    });
  });
});
