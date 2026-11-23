import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import type { ReferralItem } from "../services/referrals/interface.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const MEMBER_ID = "test-member-id";
const REQUEST_ID = "req-abc";

function makeActiveStripeMember(): MemberDocument {
  return {
    uid: MEMBER_ID,
    email: "test@example.com",
    createdAt: Timestamp.now(),
    membershipActive: true,
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    subscriptionStatus: "active",
    subscriptionStart: Timestamp.now(),
    membershipExpiresAt: Timestamp.fromDate(
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    ),
  };
}

function makeInactiveMember(): MemberDocument {
  return {
    uid: MEMBER_ID,
    email: "test@example.com",
    createdAt: Timestamp.now(),
    membershipActive: false,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * DAY_MS);
}

function makeReferralItem(
  id = REQUEST_ID,
  overrides: Partial<ReferralItem["document"]> = {},
): ReferralItem {
  return {
    id,
    document: {
      name: "Jane Smith",
      phone: "555-0100",
      email: "jane@example.com",
      zipcode: "14607",
      estimatedDueDate: { month: "3", day: "15", year: "2025" },
      services: ["birth-doula"],
      birthLocation: "Hospital",
      otherInfo: "Looking for experienced doula",
      insurance: ["medicaid"],
      submitted: Timestamp.now(),
      sent: false,
      recaptchaScore: 0.9,
      ...overrides,
    },
  };
}

describe("GET /:memberId/referrals/:requestId", () => {
  interface SetupOptions {
    memberId?: string;
    requestId?: string;
    authToken?: string | null;
    memberIsInactive?: boolean;
    v2Enabled?: boolean;
    settingsReadFails?: boolean;
    referralNotFound?: boolean;
    referral?: Partial<ReferralItem["document"]>;
    responses?: MemberResponseDocument[];
    profileUrl?: string;
    memberNotFound?: boolean;
    /** Member names by uid, for the Coordinator panel. */
    names?: Record<string, string>;
  }

  function setup({
    memberId = MEMBER_ID,
    requestId = REQUEST_ID,
    authToken = "valid-owner-token",
    memberIsInactive = false,
    v2Enabled = true,
    settingsReadFails = false,
    referralNotFound = false,
    referral = {},
    responses = [],
    profileUrl,
    memberNotFound = false,
    names = {},
  }: SetupOptions = {}) {
    const mockFindById = mock((): Promise<MemberDocument> => {
      if (memberNotFound)
        return Promise.reject(new NotFoundError("Member not found"));
      if (memberIsInactive) return Promise.resolve(makeInactiveMember());
      return Promise.resolve({
        ...makeActiveStripeMember(),
        name: "Dana Doula",
        slug: "dana-doula",
      });
    });
    const mockFindPublishedProfileUrl = mock((slug: string | undefined) =>
      Promise.resolve(slug === "dana-doula" ? profileUrl : undefined),
    );

    const mockGetReferral = mock((id: string): Promise<ReferralItem> => {
      if (referralNotFound || id !== REQUEST_ID) {
        return Promise.reject(new NotFoundError(`Referral ${id} not found`));
      }
      return Promise.resolve(makeReferralItem(id, referral));
    });

    const testApp = createMembersTestPlugin({
      memberService: {
        findById: mockFindById,
        findNamesByIds: mock((memberIds: string[]) =>
          Promise.resolve(
            new Map(
              memberIds.flatMap(memberId => {
                const name = names[memberId];
                return name ? [[memberId, name] as const] : [];
              }),
            ),
          ),
        ),
      },
      referralsService: {
        getReferral: mockGetReferral,
        listMemberResponses: mock(() => Promise.resolve(responses)),
      },
      outreachService: { findPublishedProfileUrl: mockFindPublishedProfileUrl },
      referralPortalSettingsService: {
        getReferralPortalSettings: mock(() =>
          settingsReadFails
            ? Promise.reject(new Error("Firestore unavailable"))
            : Promise.resolve({ v2Enabled }),
        ),
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/referrals/${requestId}`,
      { headers },
    );
    return { testApp, request, mockGet: mockGetReferral };
  }

  describe("Authentication", () => {
    it("returns 401 without auth header", async () => {
      const { testApp, request } = setup({ authToken: null });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(401);
    });

    it("returns 403 for non-owner", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
    });
  });

  describe("Eligibility", () => {
    it("returns 403 for owner without active Stripe membership", async () => {
      const { testApp, request } = setup({ memberIsInactive: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("Active membership required");
    });
  });

  describe("Success", () => {
    it("returns 200 with the pre-Outreach view", async () => {
      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toEqual({
        id: REQUEST_ID,
        firstName: "Jane",
        zipcode: "14607",
        area: "Rochester, NY",
        prefersSpanish: false,
        responseCount: 0,
        estimatedDueDate: { month: "3", day: "15", year: "2025" },
        services: ["birth-doula"],
        birthLocation: "Hospital",
        otherInfo: "Looking for experienced doula",
        insurance: ["medicaid"],
        submitted: expect.any(String) as string,
        outreachSender: { name: "Dana Doula", email: "test@example.com" },
        hiredBadge: false,
      });
    });

    it("never returns the requester's full name, email or phone", async () => {
      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body).not.toHaveProperty("name");
      expect(body).not.toHaveProperty("email");
      expect(body).not.toHaveProperty("phone");
      expect(body).not.toHaveProperty("sent");
      expect(body).not.toHaveProperty("recaptchaScore");
    });

    it("returns a single-word name as the first name", async () => {
      const { testApp, request } = setup({ referral: { name: "  Maya " } });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as { firstName: string };
      expect(body.firstName).toBe("Maya");
    });

    it("returns an empty first name when no name was given", async () => {
      const { testApp, request } = setup({ referral: { name: "" } });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { firstName: string };
      expect(body.firstName).toBe("");
    });

    it("returns an empty area when no ZIP code was given", async () => {
      const { testApp, request } = setup({ referral: { zipcode: "" } });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as { area: string };
      expect(body.area).toBe("");
    });

    it("flags a requester who used the Spanish form", async () => {
      const { testApp, request } = setup({ referral: { locale: "es" } });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as { prefersSpanish: boolean };
      expect(body.prefersSpanish).toBe(true);
    });

    it("returns 200 for admin access even when membership is inactive", async () => {
      const { testApp, request } = setup({
        authToken: "admin-token",
        memberIsInactive: true,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
    });
  });

  describe("Not found", () => {
    it("returns 404 when referral does not exist", async () => {
      const { testApp, request } = setup({ referralNotFound: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(404);
    });
  });

  describe("14-day window", () => {
    it("returns a Referral submitted 13 days ago", async () => {
      const { testApp, request } = setup({
        referral: { submitted: daysAgo(13) },
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
    });

    it("returns 404 REFERRAL_NOT_OPEN to a member for a Referral older than 14 days", async () => {
      const { testApp, request } = setup({
        referral: { submitted: daysAgo(15) },
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(404);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({
        error: "This referral is no longer open",
        code: "REFERRAL_NOT_OPEN",
      });
      expect(text).not.toContain("Jane");
    });

    it("lets an Admin open a Referral older than 14 days", async () => {
      const { testApp, request } = setup({
        authToken: "admin-token",
        referral: { submitted: daysAgo(30) },
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
    });

    it("lets a Referral Coordinator open a Referral older than 14 days, still pre-Outreach", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        referral: { submitted: daysAgo(30) },
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
    });
  });

  describe("Outreach", () => {
    const SENT_AT = Timestamp.fromDate(new Date("2026-11-20T15:30:00.000Z"));

    it("reveals full name, email and phone with the sent time after the member's Outreach", async () => {
      const { testApp, request } = setup({
        responses: [{ memberUid: MEMBER_ID, outreachSentAt: SENT_AT }],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["outreach"]).toEqual({ sentAt: "2026-11-20T15:30:00.000Z" });
      expect(body["contact"]).toEqual({
        fullName: "Jane Smith",
        email: "jane@example.com",
        phone: "555-0100",
      });
      expect(body).not.toHaveProperty("outreachSender");
      expect(body["responseCount"]).toBe(1);
    });

    it("keeps contact details hidden when only other members reached out", async () => {
      const { testApp, request } = setup({
        responses: [
          { memberUid: "member-b", outreachSentAt: SENT_AT },
          { memberUid: "member-c", outreachSentAt: SENT_AT },
        ],
      });
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body["responseCount"]).toBe(2);
      expect(body).not.toHaveProperty("contact");
      expect(body).not.toHaveProperty("outreach");
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
    });

    it("keeps contact details hidden while the member's Outreach is still sending", async () => {
      const { testApp, request } = setup({
        responses: [{ memberUid: MEMBER_ID, outreachPendingAt: SENT_AT }],
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("contact");
      expect(body["responseCount"]).toBe(0);
    });

    it("opens a Referral older than 14 days that the member reached out on", async () => {
      const { testApp, request } = setup({
        referral: { submitted: daysAgo(40) },
        responses: [{ memberUid: MEMBER_ID, outreachSentAt: SENT_AT }],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["contact"]).toBeDefined();
    });

    it("doesn't reveal a member's contact details to an Admin on that member's path", async () => {
      const { testApp, request } = setup({
        authToken: "admin-token",
        responses: [{ memberUid: MEMBER_ID, outreachSentAt: SENT_AT }],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("contact");
      expect(body).not.toHaveProperty("outreachSender");
    });

    it("includes the published Doula Profile link for the composer template", async () => {
      const { testApp, request } = setup({
        profileUrl: "https://doulacooperative.com/doulas/dana-doula/",
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["outreachSender"]).toEqual({
        name: "Dana Doula",
        email: "test@example.com",
        profileUrl: "https://doulacooperative.com/doulas/dana-doula/",
      });
    });

    it("leaves out the composer sender for a preview role without a member document", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        memberNotFound: true,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("outreachSender");
    });
  });

  describe("Coordinator panel", () => {
    const EARLIER = Timestamp.fromDate(new Date("2026-11-19T10:00:00.000Z"));
    const LATER = Timestamp.fromDate(new Date("2026-11-20T15:30:00.000Z"));
    const UPDATED_AT = Timestamp.fromDate(new Date("2026-11-21T09:00:00.000Z"));
    const OTHERS_RESPONSES: MemberResponseDocument[] = [
      {
        memberUid: "member-c",
        outreachSentAt: LATER,
        outcome: "hired",
        outcomeUpdatedAt: UPDATED_AT,
      },
      { memberUid: "member-b", outreachSentAt: EARLIER },
      // An in-flight send is not Outreach and is not listed.
      { memberUid: "member-d", outreachPendingAt: LATER },
    ];
    const NAMES = {
      "member-b": "Bea Doula",
      "member-c": "Cass Doula",
      "member-d": "Dee Doula",
    };

    it("lists each Member who sent Outreach, earliest first, with their Referral Outcome", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        responses: OTHERS_RESPONSES,
        names: NAMES,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["coordinator"]).toEqual({
        responses: [
          {
            memberUid: "member-b",
            memberName: "Bea Doula",
            outreachSentAt: "2026-11-19T10:00:00.000Z",
          },
          {
            memberUid: "member-c",
            memberName: "Cass Doula",
            outreachSentAt: "2026-11-20T15:30:00.000Z",
            outcome: "hired",
            outcomeUpdatedAt: "2026-11-21T09:00:00.000Z",
          },
        ],
      });
    });

    it("never gives a Coordinator the requester's full name, email or phone from others' Outreach", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        referral: { submitted: daysAgo(30) },
        responses: OTHERS_RESPONSES,
        names: NAMES,
      });
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body).not.toHaveProperty("contact");
      expect(body).not.toHaveProperty("outreach");
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
    });

    it("reveals contact details to a Coordinator only after her own Outreach, alongside the panel", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        responses: [{ memberUid: MEMBER_ID, outreachSentAt: LATER }],
        names: { [MEMBER_ID]: "Dana Doula" },
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["contact"]).toEqual({
        fullName: "Jane Smith",
        email: "jane@example.com",
        phone: "555-0100",
      });
      expect(body["coordinator"]).toEqual({
        responses: [
          {
            memberUid: MEMBER_ID,
            memberName: "Dana Doula",
            outreachSentAt: "2026-11-20T15:30:00.000Z",
          },
        ],
      });
    });

    it("leaves the name empty for a Member without one", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        responses: [{ memberUid: "member-b", outreachSentAt: EARLIER }],
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as {
        coordinator: { responses: { memberName: string }[] };
      };
      expect(body.coordinator.responses[0]?.memberName).toBe("");
    });

    it("shows an empty panel when no one has sent Outreach", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["coordinator"]).toEqual({ responses: [] });
    });

    it("gives the panel to an Admin", async () => {
      const { testApp, request } = setup({
        authToken: "admin-token",
        responses: OTHERS_RESPONSES,
        names: NAMES,
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as {
        coordinator?: { responses: unknown[] };
      };
      expect(body.coordinator?.responses).toHaveLength(2);
    });

    it("never gives the panel or other Members' names to an ordinary Member", async () => {
      const { testApp, request } = setup({
        responses: OTHERS_RESPONSES,
        names: NAMES,
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body).not.toHaveProperty("coordinator");
      expect(text).not.toContain("member-b");
      expect(text).not.toContain("Bea Doula");
      expect(text).not.toContain("Cass Doula");
    });
  });

  describe("Referral Outcome", () => {
    const SENT_AT = Timestamp.fromDate(new Date("2026-11-20T15:30:00.000Z"));
    const UPDATED_AT = Timestamp.fromDate(new Date("2026-11-21T09:00:00.000Z"));

    it("includes the member's own Referral Outcome and when it was set", async () => {
      const { testApp, request } = setup({
        responses: [
          {
            memberUid: MEMBER_ID,
            outreachSentAt: SENT_AT,
            outcome: "not_a_fit",
            outcomeUpdatedAt: UPDATED_AT,
          },
        ],
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["outcome"]).toBe("not_a_fit");
      expect(body["outcomeUpdatedAt"]).toBe("2026-11-21T09:00:00.000Z");
      expect(body["hiredBadge"]).toBe(false);
    });

    it("shows the hired badge before the member's Outreach, and Outreach stays open", async () => {
      const { testApp, request } = setup({
        responses: [
          {
            memberUid: "member-b",
            outreachSentAt: SENT_AT,
            outcome: "hired",
            outcomeUpdatedAt: UPDATED_AT,
          },
        ],
      });
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body["hiredBadge"]).toBe(true);
      expect(body["outreachSender"]).toBeDefined();
      expect(body).not.toHaveProperty("outcome");
      expect(body).not.toHaveProperty("outcomeUpdatedAt");
      expect(text).not.toContain("member-b");
    });

    it("never shows other members' non-hired Outcomes", async () => {
      const { testApp, request } = setup({
        responses: [
          {
            memberUid: "member-b",
            outreachSentAt: SENT_AT,
            outcome: "not_hired",
            outcomeUpdatedAt: UPDATED_AT,
          },
          {
            memberUid: "member-c",
            outreachSentAt: SENT_AT,
            outcome: "not_a_fit",
            outcomeUpdatedAt: UPDATED_AT,
          },
        ],
      });
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      const body = JSON.parse(text) as Record<string, unknown>;
      expect(body["hiredBadge"]).toBe(false);
      expect(body).not.toHaveProperty("outcome");
      expect(text).not.toContain("not_hired");
      expect(text).not.toContain("not_a_fit");
      expect(text).not.toContain("member-b");
    });
  });

  describe("Validation", () => {
    it("returns 422 when requestId exceeds 128 characters", async () => {
      const { testApp, request } = setup({ requestId: "a".repeat(129) });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(422);
    });
  });

  describe("Referral Portal v2 switch", () => {
    it("returns 403 REFERRAL_PORTAL_DISABLED to an active member while the switch is off", async () => {
      const { testApp, request, mockGet } = setup({ v2Enabled: false });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string; code?: string };
      expect(body.code).toBe("REFERRAL_PORTAL_DISABLED");
      expect(body.error).toBe("The referral portal is not available yet");
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("lets an Admin through while the switch is off", async () => {
      const { testApp, request } = setup({
        v2Enabled: false,
        authToken: "admin-token",
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
    });

    it("lets a Referral Coordinator without an active membership through while the switch is off", async () => {
      const { testApp, request } = setup({
        v2Enabled: false,
        memberIsInactive: true,
        authToken: "referral-coordinator-token",
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
    });

    it("lets an active member through while the switch is on", async () => {
      const { testApp, request } = setup({ v2Enabled: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
    });

    it("keeps the membership code for a lapsed member while the switch is on", async () => {
      const { testApp, request } = setup({ memberIsInactive: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(403);
      const body = (await response.json()) as { code?: string };
      expect(body.code).toBe("ACTIVE_MEMBERSHIP_REQUIRED");
    });

    it("returns 500 when the switch cannot be read", async () => {
      const { testApp, request } = setup({ settingsReadFails: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(500);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when getReferral throws a non-NotFoundError", async () => {
      const mockFindById = mock((): Promise<MemberDocument> =>
        Promise.resolve(makeActiveStripeMember()),
      );
      const mockGetReferral = mock(() =>
        Promise.reject(new Error("Unexpected DB error")),
      );
      const testApp = createMembersTestPlugin({
        memberService: { findById: mockFindById },
        referralsService: { getReferral: mockGetReferral },
      });
      const request = new Request(
        `http://localhost/${MEMBER_ID}/referrals/${REQUEST_ID}`,
        { headers: { Authorization: "Bearer valid-owner-token" } },
      );
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to retrieve referral");
    });
  });
});
