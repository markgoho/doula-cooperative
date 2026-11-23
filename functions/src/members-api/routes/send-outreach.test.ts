import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { EmailMessage } from "../../shared-api/services/email/index.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import type {
  OutreachReservation,
  OutreachService,
} from "../services/outreach/interface.js";
import type { ReferralItem } from "../services/referrals/interface.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const MEMBER_ID = "test-member-id";
const REQUEST_ID = "req-abc";
const DAY_MS = 24 * 60 * 60 * 1000;
const PROFILE_URL = "https://doulacooperative.com/doulas/dana-doula/";

function daysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * DAY_MS);
}

function makeMember(overrides: Partial<MemberDocument> = {}): MemberDocument {
  return {
    uid: MEMBER_ID,
    email: "dana@example.com",
    name: "Dana Doula",
    createdAt: Timestamp.now(),
    membershipActive: true,
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    subscriptionStatus: "active",
    subscriptionStart: Timestamp.now(),
    membershipExpiresAt: Timestamp.fromMillis(Date.now() + 30 * DAY_MS),
    ...overrides,
  };
}

function makeReferral(
  overrides: Partial<ReferralItem["document"]> = {},
): ReferralItem {
  return {
    id: REQUEST_ID,
    document: {
      name: "Jane Smith",
      phone: "555-0100",
      email: "jane@example.com",
      zipcode: "14607",
      estimatedDueDate: { month: "3", day: "15", year: "2027" },
      services: ["birth-doula"],
      birthLocation: "Hospital",
      otherInfo: "",
      insurance: [],
      submitted: daysAgo(2),
      sent: false,
      ...overrides,
    },
  };
}

interface ErrorBody {
  error: string;
  code?: string;
}

interface SuccessBody {
  outreach: { sentAt: string };
  contact: { fullName: string; email: string; phone: string };
}

function setup({
  memberId = MEMBER_ID,
  authToken = "valid-owner-token",
  message = "Hi Jane,\n\nI'd love to help.",
  body,
  member = makeMember(),
  v2Enabled = true,
  referral = makeReferral(),
  referralNotFound = false,
  responses = [],
  reservation = "reserved",
  profileUrl,
  sendFails = false,
  recordFailures = 0,
  unexpectedError = false,
}: {
  memberId?: string;
  authToken?: string | null;
  message?: string;
  body?: unknown;
  member?: MemberDocument;
  v2Enabled?: boolean;
  referral?: ReferralItem;
  referralNotFound?: boolean;
  responses?: MemberResponseDocument[];
  reservation?: OutreachReservation;
  profileUrl?: string;
  sendFails?: boolean;
  /** How many record attempts fail before one succeeds. */
  recordFailures?: number;
  unexpectedError?: boolean;
} = {}) {
  const mockSendOutreachEmail = mock<
    (parameters: {
      message: EmailMessage;
    }) => Promise<{ mailgunMessageId: string }>
  >(() =>
    sendFails
      ? Promise.reject(new Error("Mailgun rejected the message"))
      : Promise.resolve({ mailgunMessageId: "<mailgun-123@example.com>" }),
  );
  const mockReserve = mock(() => Promise.resolve(reservation));
  let recordCalls = 0;
  const mockRecord = mock<OutreachService["recordOutreach"]>(() => {
    recordCalls += 1;
    return recordCalls <= recordFailures
      ? Promise.reject(new Error("Firestore unavailable"))
      : Promise.resolve();
  });
  const mockRelease = mock(() => Promise.resolve());
  const mockAdminEmail = mock<
    (parameters: { message: EmailMessage }) => Promise<void>
  >(() => Promise.resolve());

  const testApp = createMembersTestPlugin({
    memberService: {
      findById: mock(() =>
        unexpectedError
          ? Promise.reject(new Error("DB timeout"))
          : Promise.resolve(member),
      ),
    },
    referralsService: {
      getReferral: mock(() =>
        referralNotFound
          ? Promise.reject(new NotFoundError("Referral not found"))
          : Promise.resolve(referral),
      ),
      listMemberResponses: mock(() => Promise.resolve(responses)),
    },
    referralPortalSettingsService: {
      getReferralPortalSettings: mock(() => Promise.resolve({ v2Enabled })),
    },
    outreachService: {
      reserveOutreach: mockReserve,
      recordOutreach: mockRecord,
      releaseOutreach: mockRelease,
      sendOutreachEmail: mockSendOutreachEmail,
      findPublishedProfileUrl: mock((slug: string | undefined) =>
        Promise.resolve(slug ? profileUrl : undefined),
      ),
    },
    emailService: { sendEmail: mockAdminEmail },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const request = new Request(
    `http://localhost/${memberId}/referrals/${REQUEST_ID}/outreach`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? { message }),
    },
  );

  function sentEmail(): EmailMessage {
    const [parameters] = mockSendOutreachEmail.mock.calls[0] ?? [];
    if (!parameters) throw new Error("No Outreach email was sent");
    return parameters.message;
  }

  return {
    testApp,
    request,
    mockSendOutreachEmail,
    mockReserve,
    mockRecord,
    mockRelease,
    mockAdminEmail,
    sentEmail,
  };
}

describe("POST /:memberId/referrals/:requestId/outreach", () => {
  describe("Authentication", () => {
    it("returns 401 without an auth header", async () => {
      const { testApp, request, mockSendOutreachEmail } = setup({
        authToken: null,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(401);
      expect(mockSendOutreachEmail).not.toHaveBeenCalled();
    });

    it("returns 403 for another member's path", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
    });

    it("doesn't let an Admin send Outreach on a member's behalf", async () => {
      const { testApp, request, mockSendOutreachEmail } = setup({
        authToken: "admin-token",
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OUTREACH_NOT_SELF");
      expect(mockSendOutreachEmail).not.toHaveBeenCalled();
    });
  });

  describe("Eligibility", () => {
    it("returns 403 to a member without an active membership", async () => {
      const { testApp, request, mockSendOutreachEmail } = setup({
        member: makeMember({
          membershipActive: false,
          subscriptionStatus: "canceled",
        }),
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("ACTIVE_MEMBERSHIP_REQUIRED");
      expect(mockSendOutreachEmail).not.toHaveBeenCalled();
    });

    it("returns 403 REFERRAL_PORTAL_DISABLED while the switch is off", async () => {
      const { testApp, request } = setup({ v2Enabled: false });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("REFERRAL_PORTAL_DISABLED");
    });

    it("lets a member without a Doula Profile send Outreach", async () => {
      // makeMember() has no slug, so no Doula Profile.
      const { testApp, request } = setup({ member: makeMember() });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(201);
    });
  });

  describe("Message validation", () => {
    it.each([
      ["empty", ""],
      ["whitespace-only", "   \n\t "],
    ])("rejects an %s message", async (_name, message) => {
      const { testApp, request, mockSendOutreachEmail, mockReserve } = setup({
        message,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(400);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OUTREACH_MESSAGE_REQUIRED");
      expect(mockReserve).not.toHaveBeenCalled();
      expect(mockSendOutreachEmail).not.toHaveBeenCalled();
    });

    it("rejects a message over 5000 characters", async () => {
      const { testApp, request, mockSendOutreachEmail } = setup({
        message: "a".repeat(5001),
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(422);
      expect(mockSendOutreachEmail).not.toHaveBeenCalled();
    });

    it("rejects a body without a message", async () => {
      const { testApp, request } = setup({ body: {} });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(422);
    });
  });

  describe("Referral window", () => {
    it("returns 404 when the Referral doesn't exist", async () => {
      const { testApp, request } = setup({ referralNotFound: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(404);
    });

    it("returns 404 REFERRAL_NOT_OPEN for a Referral older than 14 days", async () => {
      const { testApp, request, mockSendOutreachEmail } = setup({
        referral: makeReferral({ submitted: daysAgo(15) }),
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(404);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("REFERRAL_NOT_OPEN");
      expect(mockSendOutreachEmail).not.toHaveBeenCalled();
    });
  });

  describe("One Outreach per member", () => {
    it("rejects a second Outreach by the same member with 409", async () => {
      const { testApp, request, mockSendOutreachEmail, mockReserve } = setup({
        responses: [{ memberUid: MEMBER_ID, outreachSentAt: daysAgo(1) }],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(409);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OUTREACH_ALREADY_SENT");
      expect(mockReserve).not.toHaveBeenCalled();
      expect(mockSendOutreachEmail).not.toHaveBeenCalled();
    });

    it.each([
      ["already_sent", "OUTREACH_ALREADY_SENT"],
      ["in_progress", "OUTREACH_IN_PROGRESS"],
    ] as const)(
      "returns 409 when the reservation says %s, without sending",
      async (reservation, code) => {
        const { testApp, request, mockSendOutreachEmail } = setup({
          reservation,
        });
        const response = await handleRequest(testApp, request);
        expect(response.status).toBe(409);
        const body = (await response.json()) as ErrorBody;
        expect(body.code).toBe(code);
        expect(mockSendOutreachEmail).not.toHaveBeenCalled();
      },
    );

    it("lets a Referral Coordinator send her own Outreach on a Referral older than 14 days", async () => {
      const { testApp, request, mockSendOutreachEmail } = setup({
        authToken: "referral-coordinator-token",
        referral: makeReferral({ submitted: daysAgo(30) }),
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(201);
      expect(mockSendOutreachEmail).toHaveBeenCalledTimes(1);
    });

    it("lets a member reach out when other members already did", async () => {
      const { testApp, request } = setup({
        responses: [{ memberUid: "member-b", outreachSentAt: daysAgo(1) }],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(201);
    });
  });

  describe("Success", () => {
    it("returns 201 with the sent time and the requester's contact details", async () => {
      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(201);
      const body = (await response.json()) as SuccessBody;
      expect(Number.isNaN(Date.parse(body.outreach.sentAt))).toBe(false);
      expect(body.contact).toEqual({
        fullName: "Jane Smith",
        email: "jane@example.com",
        phone: "555-0100",
      });
    });

    it("emails the requester from the member via Doula Cooperative, Reply-To and BCC the member", async () => {
      const { testApp, request, sentEmail } = setup();
      await handleRequest(testApp, request);
      const email = sentEmail();
      expect(email.from).toBe(
        '"Dana Doula via Doula Cooperative" <noreply@mg.doulacooperative.com>',
      );
      expect(email.to).toBe("jane@example.com");
      expect(email.bcc).toBe("dana@example.com");
      expect(email["h:Reply-To"]).toBe("dana@example.com");
      expect(email.subject).toBe("A doula from Rochester Doula Cooperative");
      expect(email.text).toContain("Hi Jane,\n\nI'd love to help.");
    });

    it("escapes the message in the HTML part", async () => {
      const { testApp, request, sentEmail } = setup({
        message: 'Hi <script>alert("x")</script>',
      });
      await handleRequest(testApp, request);
      const { html, text } = sentEmail();
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(text).toContain('Hi <script>alert("x")</script>');
    });

    it("strips header-breaking characters from the member's name", async () => {
      const { testApp, request, sentEmail } = setup({
        member: makeMember({ name: 'Dana "D" <x>\r\nBcc: evil@example.com' }),
      });
      await handleRequest(testApp, request);
      const { from } = sentEmail();
      expect(from).toBe(
        '"Dana D x Bcc: evil@example.com via Doula Cooperative" <noreply@mg.doulacooperative.com>',
      );
    });

    it("sends from Doula Cooperative when the member has no name", async () => {
      const member = makeMember();
      delete member.name;
      const { testApp, request, sentEmail } = setup({ member });
      await handleRequest(testApp, request);
      expect(sentEmail().from).toBe(
        '"Doula Cooperative" <noreply@mg.doulacooperative.com>',
      );
    });

    it("adds the published Doula Profile link when the message doesn't include it", async () => {
      const { testApp, request, sentEmail } = setup({
        member: makeMember({ slug: "dana-doula" }),
        profileUrl: PROFILE_URL,
      });
      await handleRequest(testApp, request);
      const { text, html } = sentEmail();
      expect(text).toContain(`Doula Profile: ${PROFILE_URL}`);
      expect(html).toContain(`href="${PROFILE_URL}"`);
    });

    it("doesn't repeat the Doula Profile link the message already includes", async () => {
      const { testApp, request, sentEmail } = setup({
        member: makeMember({ slug: "dana-doula" }),
        profileUrl: PROFILE_URL,
        message: `Read about me: ${PROFILE_URL}`,
      });
      await handleRequest(testApp, request);
      const text = String(sentEmail().text);
      expect(text.split(PROFILE_URL)).toHaveLength(2);
      expect(text).not.toContain("Doula Profile:");
    });

    it("records metadata only: member, sent time and Mailgun id, never the message", async () => {
      const { testApp, request, mockRecord } = setup({
        message: "A private note about my availability",
      });
      await handleRequest(testApp, request);
      expect(mockRecord).toHaveBeenCalledTimes(1);
      const [target] = mockRecord.mock.calls[0] ?? [];
      expect(target).toEqual({
        requestId: REQUEST_ID,
        memberUid: MEMBER_ID,
        sentAt: expect.any(Date) as Date,
        mailgunMessageId: "<mailgun-123@example.com>",
      });
      expect(JSON.stringify(target)).not.toContain("private note");
    });
  });

  describe("Mailgun rejects the send", () => {
    it("records and reveals nothing, and returns a retryable error", async () => {
      const { testApp, request, mockRecord, mockRelease } = setup({
        sendFails: true,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(502);
      const text = await response.text();
      const body = JSON.parse(text) as ErrorBody;
      expect(body.code).toBe("OUTREACH_SEND_FAILED");
      expect(mockRecord).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalledWith(
        { requestId: REQUEST_ID, memberUid: MEMBER_ID },
        expect.anything(),
      );
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
    });
  });

  describe("Recording fails after Mailgun accepted", () => {
    it("retries the write and succeeds when a later attempt works", async () => {
      const { testApp, request, mockRecord, mockSendOutreachEmail } = setup({
        recordFailures: 2,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(201);
      expect(mockRecord).toHaveBeenCalledTimes(3);
      expect(mockSendOutreachEmail).toHaveBeenCalledTimes(1);
    });

    it("returns 500 without revealing contact details and notifies the admins", async () => {
      const { testApp, request, mockAdminEmail, mockRecord } = setup({
        recordFailures: 3,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(500);
      expect(mockRecord).toHaveBeenCalledTimes(3);
      const text = await response.text();
      const body = JSON.parse(text) as ErrorBody;
      expect(body.code).toBe("OUTREACH_RECORD_FAILED");
      expect(text).not.toContain("jane@example.com");
      expect(mockAdminEmail).toHaveBeenCalledTimes(1);
      const [parameters] = mockAdminEmail.mock.calls[0] ?? [];
      expect(parameters?.message.subject).toContain(
        "Outreach sent but not recorded",
      );
    });
  });

  describe("Error handling", () => {
    it("returns 500 on an unexpected failure", async () => {
      const { testApp, request } = setup({ unexpectedError: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(500);
      const body = (await response.json()) as ErrorBody;
      expect(body.error).toBe("Failed to send Outreach. Please try again.");
    });
  });
});
