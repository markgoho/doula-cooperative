import { describe, expect, it, mock } from "bun:test";
import { MARK_EMAIL, REFERRAL_EMAIL } from "../../constants/email-addresses.js";
import type { EmailMessage } from "../../shared-api/services/email/index.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { DoulaMatchFormBody } from "../schemas/form-response-schemas.js";
import type { DoulaMatchData } from "../services/form-storage/types.js";
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
    recaptchaScoreTooLow?: boolean;
    emailSendFails?: boolean;
    firestoreSaveFails?: boolean;
    matchRequestId?: string;
  }

  function setup({
    body = {
      name: "Jane Smith",
      phone: "555-1234",
      email: "jane@example.com",
      zipcode: "14620",
      estimatedDueDate: {
        month: "3",
        day: "25",
        year: "2027",
      },
      services: ["Birth Support", "Postpartum Care"],
      birthLocation: "Hospital ABC",
      otherInfo: "First time parent",
      insurance: ["Aetna"],
      recaptchaToken: "valid-token",
    },
    recaptchaSecretKey = "test-recaptcha-key",
    recaptchaVerificationFails = false,
    recaptchaScoreTooLow = false,
    emailSendFails = false,
    firestoreSaveFails = false,
    matchRequestId = "abc123",
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

    const mockSaveMatchRequest = mock<
      (options: { id: string; data: DoulaMatchData }) => Promise<void>
    >(() => {
      if (firestoreSaveFails) {
        return Promise.reject(
          new Error(
            "Failed to save doula match request to Firestore after email was sent: Quota exceeded",
          ),
        );
      }
      return Promise.resolve();
    });

    const mockSendEmail = mock<
      (options: { message: EmailMessage }) => Promise<void>
    >(() => {
      if (emailSendFails) {
        return Promise.reject(new Error("Mailgun timeout"));
      }
      return Promise.resolve();
    });

    // Create plugin with mocked services
    const plugin = createDoulaMatchFormTestPlugin({
      formStorageService: {
        createMatchRequestId: mock(() => matchRequestId),
        saveMatchRequest: mockSaveMatchRequest,
      },
      emailService: { sendEmail: mockSendEmail },
      recaptchaService: mockRecaptchaService,
    });

    // Build request from parameters
    const request = new Request("http://localhost/doula-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    function sentMessage(): EmailMessage {
      const [call] = mockSendEmail.mock.calls;
      if (call === undefined) {
        throw new Error("Expected a notification email to be sent");
      }
      return call[0].message;
    }

    return { plugin, request, mockSaveMatchRequest, sentMessage };
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

      const response = await handleRequest(plugin, request);

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

      const response = await handleRequest(plugin, request);

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

      const response = await handleRequest(plugin, request);

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

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Configuration Errors", () => {
    it("should return 500 when RECAPTCHA_SECRET_KEY is not configured", async () => {
      const { plugin, request } = setup({
        recaptchaSecretKey: null,
      });

      const response = await handleRequest(plugin, request);

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

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing reCAPTCHA token");
    });

    it("should return 400 when reCAPTCHA verification fails", async () => {
      const { plugin, request } = setup({
        recaptchaVerificationFails: true,
      });

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("reCAPTCHA verification failed");
    });

    it("should return 400 when reCAPTCHA score is below threshold", async () => {
      const { plugin, request } = setup({
        recaptchaScoreTooLow: true,
      });

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("reCAPTCHA verification failed");
    });
  });

  describe("Successful Submission", () => {
    it("should save form and send email on successful submission", async () => {
      const { plugin, request } = setup();

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        emailSent?: boolean;
      };
      expect(body.success).toBe(true);
      expect(body.emailSent).toBe(true);
    });

    it("should save the Match Request under the id linked from the notification", async () => {
      const { plugin, request, mockSaveMatchRequest, sentMessage } = setup({
        matchRequestId: "match-42",
      });

      await handleRequest(plugin, request);

      expect(mockSaveMatchRequest).toHaveBeenCalledTimes(1);
      expect(mockSaveMatchRequest.mock.calls[0]?.[0].id).toBe("match-42");
      expect(sentMessage().html).toContain(
        'href="https://admin.doulacooperative.com/match-requests/match-42"',
      );
    });

    it("should accept Spanish locale submission and save the locale", async () => {
      const { plugin, request, mockSaveMatchRequest } = setup({
        body: {
          name: "María García",
          phone: "555-5678",
          email: "maria@example.com",
          zipcode: "14620",
          estimatedDueDate: { month: "6", day: "15", year: "2027" },
          services: ["apoyo de doula de parto"],
          birthLocation: "Highland Hospital",
          otherInfo: "",
          insurance: [],
          recaptchaToken: "valid-token",
          locale: "es",
        },
      });

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(200);
      expect(mockSaveMatchRequest).toHaveBeenCalledTimes(1);
      expect(mockSaveMatchRequest.mock.calls[0]?.[0].data.locale).toBe("es");
    });

    it("should return 422 when locale is an unsupported value", async () => {
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
          recaptchaToken: "valid-token",
          // @ts-expect-error intentionally invalid locale
          locale: "fr",
        },
      });

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Match Request Notification content", () => {
    const requesterDetails = {
      name: "Jane Smith",
      phone: "555-1234",
      email: "jane@example.com",
      birthLocation: "Hospital ABC",
      otherInfo: "First time parent",
      insurance: ["Aetna"],
    };

    function bodyWith(
      overrides: Partial<DoulaMatchFormBody> = {},
    ): Partial<DoulaMatchFormBody> {
      return {
        ...requesterDetails,
        zipcode: "14620",
        estimatedDueDate: { month: "3", day: "25", year: "2027" },
        services: ["Birth Support", "Postpartum Care"],
        recaptchaToken: "valid-token",
        ...overrides,
      };
    }

    it("should send to the unchanged admin recipients with no Reply-To", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      const message = sentMessage();
      expect(message.to).toEqual([MARK_EMAIL, REFERRAL_EMAIL]);
      expect(message).not.toHaveProperty("h:Reply-To");
    });

    it("should use a subject with due month and area but no requester name", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      expect(sentMessage().subject).toBe(
        "New match request: due Mar 2027 · Rochester, NY",
      );
    });

    it("should include due month/year, services, area and admin link", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith(),
        matchRequestId: "abc123",
      });

      await handleRequest(plugin, request);

      const { html } = sentMessage();
      expect(html).toContain("Mar 2027");
      expect(html).toContain("Birth Support, Postpartum Care");
      expect(html).toContain("Rochester, NY");
      expect(html).toContain(
        "https://admin.doulacooperative.com/match-requests/abc123",
      );
      expect(html).not.toContain("Spanish");
    });

    it("should leave out every requester detail outside the allowed fields", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      const { subject, html } = sentMessage();
      const content = `${subject}\n${html}`;
      expect(content).not.toContain("Jane");
      expect(content).not.toContain("Smith");
      expect(content).not.toContain("jane@example.com");
      expect(content).not.toContain("555-1234");
      expect(content).not.toContain("Hospital ABC");
      expect(content).not.toContain("First time parent");
      expect(content).not.toContain("Aetna");
      expect(content).not.toContain("14620");
      expect(content).not.toMatch(/\b25\b/);
    });

    it("should flag Spanish in the subject and body when locale is es", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({ locale: "es" }),
      });

      await handleRequest(plugin, request);

      const { subject, html } = sentMessage();
      expect(subject).toBe(
        "New match request: due Mar 2027 · Rochester, NY · Spanish",
      );
      expect(html).toContain("Requester prefers Spanish");
    });

    it("should not flag Spanish when locale is en", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({ locale: "en" }),
      });

      await handleRequest(plugin, request);

      const { subject, html } = sentMessage();
      expect(subject).not.toContain("Spanish");
      expect(html).not.toContain("Spanish");
    });

    it("should fall back to the raw ZIP when the area lookup fails", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({ zipcode: "00000" }),
      });

      await handleRequest(plugin, request);

      const { subject, html } = sentMessage();
      expect(subject).toBe("New match request: due Mar 2027 · ZIP 00000");
      expect(html).toContain("ZIP 00000");
    });

    it("should resolve the area from a ZIP+4 code", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({ zipcode: "14620-1234" }),
      });

      await handleRequest(plugin, request);

      expect(sentMessage().subject).toBe(
        "New match request: due Mar 2027 · Rochester, NY",
      );
    });

    it("should fall back to the year alone for an unrecognized month", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({
          estimatedDueDate: { month: "13", day: "1", year: "2027" },
        }),
      });

      await handleRequest(plugin, request);

      expect(sentMessage().subject).toBe(
        "New match request: due 2027 · Rochester, NY",
      );
    });

    it("should HTML-escape requester-supplied services", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({ services: ["<script>alert(1)</script>"] }),
      });

      await handleRequest(plugin, request);

      const { html } = sentMessage();
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });
  });

  describe("Email Failure Handling", () => {
    it("should save form and return warning when email send fails", async () => {
      const { plugin, request } = setup({
        emailSendFails: true,
      });

      const response = await handleRequest(plugin, request);

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

      const response = await handleRequest(plugin, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Internal server error");
    });
  });
});
