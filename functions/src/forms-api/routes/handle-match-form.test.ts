import { describe, expect, it, mock } from "bun:test";
import type { DoulaMatchFormBody } from "../schemas/form-response-schemas.js";
import type { RecaptchaService } from "../services/recaptcha/interface.js";
import { createDoulaMatchFormTestPlugin } from "../test-utils/create-forms-test-plugins.js";

/**
 * Tests for POST /doula-match route.
 *
 * Uses plugin factory with mocked services.
 */
describe("POST /doula-match", () => {
  interface SetupOptions {
    // Request body - form data (Partial to allow omitting fields in tests)
    body?: Partial<DoulaMatchFormBody>;

    // Environment
    recaptchaSecretKey?: string | null;

    // Scenario flags
    recaptchaVerificationFails?: boolean;
    emailSendFails?: boolean;
    firestoreSaveFails?: boolean;
  }

  function setup({
    body = {
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
    },
    recaptchaSecretKey = "test-recaptcha-key",
    recaptchaVerificationFails = false,
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
        return Promise.resolve({
          success: true,
          score: 0.9,
        });
      }),
    };

    const mockSaveMatchRequest = mock(() => {
      if (firestoreSaveFails) {
        return Promise.reject(
          new Error(
            "Failed to save doula match request to Firestore after email was sent: Quota exceeded",
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
    const plugin = createDoulaMatchFormTestPlugin({
      formStorageService: { saveMatchRequest: mockSaveMatchRequest },
      emailService: { sendEmail: mockSendEmail },
      recaptchaService: mockRecaptchaService,
    });

    // Build request from parameters
    const request = new Request("http://localhost/doula-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return { plugin, request };
  }

  describe("Validation", () => {
    it("should return 422 when name is missing", async () => {
      const { plugin, request } = setup({
        body: {
          phone: "555-1234",
          email: "test@example.com",
          zipcode: "12345",
          estimatedDueDate: { month: "12", day: "25", year: "2024" },
          services: ["Birth Support"],
          birthLocation: "Hospital",
          otherInfo: "",
          insurance: [],
          // Missing name
        },
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when email is invalid", async () => {
      const { plugin, request } = setup({
        body: {
          name: "Test",
          phone: "555-1234",
          email: "invalid-email",
          zipcode: "12345",
          estimatedDueDate: { month: "12", day: "25", year: "2024" },
          services: ["Birth Support"],
          birthLocation: "Hospital",
          otherInfo: "",
          insurance: [],
        },
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when zipcode is too short", async () => {
      const { plugin, request } = setup({
        body: {
          name: "Test",
          phone: "555-1234",
          email: "test@example.com",
          zipcode: "123", // Too short
          estimatedDueDate: { month: "12", day: "25", year: "2024" },
          services: ["Birth Support"],
          birthLocation: "Hospital",
          otherInfo: "",
          insurance: [],
        },
      });

      const response = (await plugin.handle(request)) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 422 when services array is missing", async () => {
      const { plugin, request } = setup({
        body: {
          name: "Test",
          phone: "555-1234",
          email: "test@example.com",
          zipcode: "12345",
          estimatedDueDate: { month: "12", day: "25", year: "2024" },
          birthLocation: "Hospital",
          otherInfo: "",
          insurance: [],
          // Missing services
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
          name: "Test",
          phone: "555-1234",
          email: "test@example.com",
          zipcode: "12345",
          estimatedDueDate: { month: "12", day: "25", year: "2024" },
          services: ["Birth Support"],
          birthLocation: "Hospital",
          otherInfo: "",
          insurance: [],
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
