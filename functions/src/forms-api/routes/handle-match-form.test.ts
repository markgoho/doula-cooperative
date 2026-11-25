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

    it("should save the Match Request under the pre-allocated id", async () => {
      const { plugin, request, mockSaveMatchRequest } = setup({
        matchRequestId: "match-42",
      });

      await handleRequest(plugin, request);

      expect(mockSaveMatchRequest).toHaveBeenCalledTimes(1);
      expect(mockSaveMatchRequest.mock.calls[0]?.[0].id).toBe("match-42");
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

    it("should send to the admin and referral inboxes with Reply-To the requester", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      const message = sentMessage();
      expect(message.to).toEqual([MARK_EMAIL, REFERRAL_EMAIL]);
      expect(message["h:Reply-To"]).toBe("jane@example.com");
    });

    it("should name the requester in the subject", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      expect(sentMessage().subject).toBe(
        "New Doula Match Request from Jane Smith",
      );
    });

    it("should include the full request for the Referral Coordinator to relay", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      const { html } = sentMessage();
      expect(html).toContain("<strong>Name:</strong> Jane Smith");
      expect(html).toContain("<strong>Email:</strong> jane@example.com");
      expect(html).toContain("<strong>Phone:</strong> 555-1234");
      expect(html).toContain("<strong>ZIP Code:</strong> 14620");
      expect(html).toContain("<strong>Estimated Due Date:</strong> 3/25/2027");
      expect(html).toContain(
        "<strong>Services:</strong> Birth Support, Postpartum Care",
      );
      expect(html).toContain("<strong>Insurance/Cost offset:</strong> Aetna");
      expect(html).toContain("<strong>Birth Location:</strong> Hospital ABC");
      expect(html).toContain("First time parent");
    });

    it("should omit the insurance line when none was chosen", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({ insurance: [] }),
      });

      await handleRequest(plugin, request);

      expect(sentMessage().html).not.toContain("Insurance/Cost offset");
    });

    it("should not link to the admin app", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      const { html } = sentMessage();
      expect(html).not.toContain("admin.doulacooperative.com");
      expect(html).not.toContain("<a ");
    });

    it("should show the language when a locale was submitted", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({ locale: "es" }),
      });

      await handleRequest(plugin, request);

      expect(sentMessage().html).toContain(
        "<strong>Language:</strong> Spanish (es)",
      );
    });

    it("should leave out the language line when no locale was submitted", async () => {
      const { plugin, request, sentMessage } = setup({ body: bodyWith() });

      await handleRequest(plugin, request);

      expect(sentMessage().html).not.toContain("Language:");
    });

    it("should HTML-escape every requester-supplied field", async () => {
      const { plugin, request, sentMessage } = setup({
        body: bodyWith({
          name: "<b>Jane</b>",
          services: ["<script>alert(1)</script>"],
          birthLocation: "<i>Hospital</i>",
          otherInfo: "<img src=x onerror=alert(1)>",
          insurance: ["<u>Aetna</u>"],
        }),
      });

      await handleRequest(plugin, request);

      const { html } = sentMessage();
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<b>Jane</b>");
      expect(html).not.toContain("<i>Hospital</i>");
      expect(html).not.toContain("<img");
      expect(html).not.toContain("<u>Aetna</u>");
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
