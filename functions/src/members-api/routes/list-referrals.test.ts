import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import type { ReferralItem } from "../services/referrals/interface.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const MEMBER_ID = "test-member-id";
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * DAY_MS);
}

function makeReferral(
  id: string,
  overrides: Partial<ReferralItem["document"]> = {},
): ReferralItem {
  return {
    id,
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
      submitted: daysAgo(1),
      sent: false,
      ...overrides,
    },
  };
}

function outreachBy(
  memberUid: string,
  sentDaysAgo = 1,
): MemberResponseDocument {
  return { memberUid, outreachSentAt: daysAgo(sentDaysAgo) };
}

function outcomeBy(
  memberUid: string,
  outcome: NonNullable<MemberResponseDocument["outcome"]>,
): MemberResponseDocument {
  return {
    ...outreachBy(memberUid),
    outcome,
    outcomeUpdatedAt: daysAgo(0),
  };
}

interface ListedReferral {
  id: string;
  responseCount: number;
  isOpen: boolean;
  outreach?: { sentAt: string };
  offlineResponse?: { recordedAt: string };
  outcome?: string;
  hiredBadge: boolean;
}

async function listed(response: Response): Promise<ListedReferral[]> {
  const body = (await response.json()) as { referrals: ListedReferral[] };
  return body.referrals;
}

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

describe("GET /:memberId/referrals", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    memberNotFound?: boolean;
    memberIsInactive?: boolean;
    v2Enabled?: boolean;
    settingsReadFails?: boolean;
    serverError?: boolean;
    /** Open Referrals (the service applies the 14-day cutoff). */
    referrals?: ReferralItem[];
    /** Every Referral regardless of age (what a Referral Coordinator gets). */
    allReferrals?: ReferralItem[];
    /** Referrals of any age holding a response document for the viewer. */
    respondedReferrals?: ReferralItem[];
    /** Member response documents by Referral id. */
    responses?: Record<string, MemberResponseDocument[]>;
    /** Offline Responses for Legacy Memberships by Referral id. */
    legacyResponses?: Record<string, LegacyResponseDocument[]>;
  }

  function setup({
    memberId = MEMBER_ID,
    authToken = "valid-owner-token",
    memberNotFound = false,
    memberIsInactive = false,
    v2Enabled = true,
    settingsReadFails = false,
    serverError = false,
    referrals = [],
    allReferrals = [],
    respondedReferrals = [],
    responses = {},
    legacyResponses = {},
  }: SetupOptions = {}) {
    const mockFindById = mock((): Promise<MemberDocument> => {
      if (memberNotFound)
        return Promise.reject(new NotFoundError("Member not found"));
      if (serverError) return Promise.reject(new Error("DB timeout"));
      if (memberIsInactive) return Promise.resolve(makeInactiveMember());
      return Promise.resolve(makeActiveStripeMember());
    });

    const mockListReferrals = mock(() => Promise.resolve(referrals));
    const mockListResponded = mock<
      (memberUid: string) => Promise<ReferralItem[]>
    >(() => Promise.resolve(respondedReferrals));

    const testApp = createMembersTestPlugin({
      memberService: { findById: mockFindById },
      referralsService: {
        listReferrals: mockListReferrals,
        listAllReferrals: mock(() => Promise.resolve(allReferrals)),
        listReferralsWithMemberResponse: mockListResponded,
        listMemberResponses: mock((requestId: string) =>
          Promise.resolve(responses[requestId] ?? []),
        ),
        listLegacyResponses: mock((requestId: string) =>
          Promise.resolve(legacyResponses[requestId] ?? []),
        ),
      },
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

    const request = new Request(`http://localhost/${memberId}/referrals`, {
      headers,
    });
    return {
      testApp,
      request,
      mockGet: mockListReferrals,
      mockListResponded,
    };
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
    // The route trusts referralsService.listReferrals to have already applied
    // the 14-day Firestore cutoff (see referrals-service.ts); an empty result
    // here represents "no referrals submitted in the last 14 days".
    it("returns 200 with empty list when no referrals in the last 14 days", async () => {
      const { testApp, request } = setup({ referrals: [] });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { referrals: unknown[] };
      expect(body.referrals).toEqual([]);
    });

    it("returns newest-first public referral items for an active Stripe owner", async () => {
      const submitted = Timestamp.now();
      const { testApp, request } = setup({
        referrals: [
          {
            id: "req-newest",
            document: {
              name: "Jane Smith",
              phone: "555-0100",
              email: "jane@example.com",
              zipcode: "14607",
              estimatedDueDate: { month: "3", day: "15", year: "2025" },
              services: ["birth-doula"],
              birthLocation: "Hospital",
              otherInfo: "",
              insurance: ["medicaid"],
              submitted,
              sent: false,
            },
          },
          {
            id: "req-earlier",
            document: {
              name: "Older Request",
              phone: "555-0200",
              email: "older@example.com",
              zipcode: "14608",
              estimatedDueDate: { month: "4", day: "2", year: "2025" },
              services: ["postpartum-doula"],
              birthLocation: "Home",
              otherInfo: "",
              insurance: [],
              submitted: Timestamp.fromMillis(submitted.toMillis() - 60_000),
              sent: false,
            },
          },
        ],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const text = await response.text();
      const body = JSON.parse(text) as {
        referrals: {
          id: string;
          area: string;
          services: string[];
          responseCount: number;
        }[];
      };
      expect(body.referrals).toHaveLength(2);
      expect(body.referrals.map(referral => referral.id)).toEqual([
        "req-newest",
        "req-earlier",
      ]);
      expect(body.referrals[0]?.area).toBe("Rochester, NY");
      expect(body.referrals[0]?.services).toEqual(["birth-doula"]);
      expect(body.referrals[0]?.responseCount).toBe(0);
      // Privacy: no requester name or contact details anywhere in the payload
      expect(text).not.toContain("Jane");
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
      expect(body.referrals[0]).not.toHaveProperty("zipcode");
      expect(body.referrals[0]).not.toHaveProperty("name");
      expect(body.referrals[0]).not.toHaveProperty("email");
      expect(body.referrals[0]).not.toHaveProperty("phone");
      expect(body.referrals[0]).not.toHaveProperty("otherInfo");
      expect(body.referrals[0]).not.toHaveProperty("insurance");
      expect(body.referrals[0]).not.toHaveProperty("sent");
      expect(body.referrals[0]).not.toHaveProperty("recaptchaScore");
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

  describe("Outreach", () => {
    it("counts distinct members who sent Outreach, ignoring in-flight sends", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-1")],
        responses: {
          "req-1": [
            outreachBy("member-a"),
            outreachBy("member-b"),
            { memberUid: "member-c", outreachPendingAt: Timestamp.now() },
          ],
        },
      });
      const [referral] = await listed(await handleRequest(testApp, request));
      expect(referral?.responseCount).toBe(2);
      expect(referral).not.toHaveProperty("outreach");
    });

    it("marks the Referrals the member reached out on", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-mine"), makeReferral("req-other")],
        responses: {
          "req-mine": [outreachBy(MEMBER_ID), outreachBy("member-b")],
          "req-other": [outreachBy("member-b")],
        },
      });
      const referrals = await listed(await handleRequest(testApp, request));
      const mine = referrals.find(referral => referral.id === "req-mine");
      const other = referrals.find(referral => referral.id === "req-other");
      expect(typeof mine?.outreach?.sentAt).toBe("string");
      expect(mine?.responseCount).toBe(2);
      expect(other).not.toHaveProperty("outreach");
    });

    it("lists Referrals older than 14 days the member reached out on, as not open", async () => {
      const old = makeReferral("req-old", { submitted: daysAgo(40) });
      const { testApp, request, mockListResponded } = setup({
        referrals: [makeReferral("req-open")],
        respondedReferrals: [old],
        responses: { "req-old": [outreachBy(MEMBER_ID, 35)] },
      });
      const referrals = await listed(await handleRequest(testApp, request));
      expect(mockListResponded).toHaveBeenCalledWith(
        MEMBER_ID,
        expect.anything(),
      );
      expect(referrals.map(referral => referral.id)).toEqual([
        "req-open",
        "req-old",
      ]);
      expect(referrals[0]?.isOpen).toBe(true);
      expect(referrals[1]?.isOpen).toBe(false);
      expect(referrals[1]?.outreach).toBeDefined();
    });

    it("leaves out an old Referral whose only trace is an in-flight send", async () => {
      const { testApp, request } = setup({
        respondedReferrals: [
          makeReferral("req-old", { submitted: daysAgo(40) }),
        ],
        responses: {
          "req-old": [{ memberUid: MEMBER_ID, outreachPendingAt: daysAgo(30) }],
        },
      });
      expect(await listed(await handleRequest(testApp, request))).toEqual([]);
    });

    it("lists a Referral that is both open and reached out on once", async () => {
      const referral = makeReferral("req-1");
      const { testApp, request } = setup({
        referrals: [referral],
        respondedReferrals: [referral],
        responses: { "req-1": [outreachBy(MEMBER_ID)] },
      });
      const referrals = await listed(await handleRequest(testApp, request));
      expect(referrals).toHaveLength(1);
    });

    it("still lists open Referrals when reached-out ones can't be read", async () => {
      const testApp = createMembersTestPlugin({
        memberService: {
          findById: mock(() => Promise.resolve(makeActiveStripeMember())),
        },
        referralsService: {
          listReferrals: mock(() => Promise.resolve([makeReferral("req-1")])),
          listReferralsWithMemberResponse: mock(() =>
            Promise.reject(new Error("FAILED_PRECONDITION: index missing")),
          ),
        },
      });
      const request = new Request(`http://localhost/${MEMBER_ID}/referrals`, {
        headers: { Authorization: "Bearer valid-owner-token" },
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const referrals = await listed(response);
      expect(referrals.map(referral => referral.id)).toEqual(["req-1"]);
    });

    it("never reveals contact details on reached-out rows", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-1")],
        responses: { "req-1": [outreachBy(MEMBER_ID)] },
      });
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
    });
  });

  describe("Offline Responses", () => {
    const offlineFor = (memberUid: string): MemberResponseDocument => ({
      memberUid,
      offlineResponse: { recordedBy: "coord-uid", recordedAt: daysAgo(30) },
    });

    it("lists a Referral older than 14 days that an Offline Response names the member on, without contact details", async () => {
      const { testApp, request } = setup({
        respondedReferrals: [
          makeReferral("req-old", { submitted: daysAgo(40) }),
        ],
        responses: { "req-old": [offlineFor(MEMBER_ID)] },
      });
      const response = await handleRequest(testApp, request);
      const text = await response.clone().text();
      const [referral] = await listed(response);
      expect(referral?.id).toBe("req-old");
      expect(referral?.isOpen).toBe(false);
      expect(typeof referral?.offlineResponse?.recordedAt).toBe("string");
      expect(referral).not.toHaveProperty("outreach");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("coord-uid");
    });

    it("counts Offline Responses for Members and Legacy Memberships, each doula once", async () => {
      const legacy: LegacyResponseDocument = {
        legacyEmail: "lee@example.com",
        displayName: "Lee Legacy",
        recordedBy: "coord-uid",
        recordedAt: daysAgo(1),
      };
      const { testApp, request } = setup({
        referrals: [makeReferral("req-1")],
        responses: {
          "req-1": [
            outreachBy("member-a"),
            offlineFor("member-b"),
            { ...offlineFor("member-c"), outreachSentAt: daysAgo(0) },
          ],
        },
        legacyResponses: { "req-1": [legacy] },
      });
      const response = await handleRequest(testApp, request);
      const text = await response.clone().text();
      const [referral] = await listed(response);
      expect(referral?.responseCount).toBe(4);
      expect(text).not.toContain("lee@example.com");
    });
  });

  describe("Referral Outcome", () => {
    it("marks the member's own Referral Outcome on each row", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-1"), makeReferral("req-2")],
        responses: {
          "req-1": [outcomeBy(MEMBER_ID, "not_hired")],
          "req-2": [outreachBy(MEMBER_ID)],
        },
      });
      const referrals = await listed(await handleRequest(testApp, request));
      const byId = new Map(referrals.map(referral => [referral.id, referral]));
      expect(byId.get("req-1")?.outcome).toBe("not_hired");
      expect(byId.get("req-2")).not.toHaveProperty("outcome");
    });

    it("shows the hired badge to every viewer once any member is hired", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-1"), makeReferral("req-2")],
        responses: { "req-1": [outcomeBy("member-b", "hired")] },
      });
      const referrals = await listed(await handleRequest(testApp, request));
      const byId = new Map(referrals.map(referral => [referral.id, referral]));
      expect(byId.get("req-1")?.hiredBadge).toBe(true);
      expect(byId.get("req-1")).not.toHaveProperty("outcome");
      expect(byId.get("req-2")?.hiredBadge).toBe(false);
    });

    it("shows the hired badge when a Coordinator recorded a hire for a doula not yet migrated, without naming them", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-1")],
        legacyResponses: {
          "req-1": [
            {
              legacyEmail: "lee@example.com",
              displayName: "Lee Legacy",
              recordedBy: "coord-uid",
              recordedAt: daysAgo(1),
              outcome: "hired",
            },
          ],
        },
      });
      const response = await handleRequest(testApp, request);
      const text = await response.clone().text();
      const [referral] = await listed(response);
      expect(referral?.hiredBadge).toBe(true);
      expect(referral?.responseCount).toBe(1);
      expect(text).not.toContain("Lee Legacy");
    });

    it("never shows other members' names or non-hired Outcomes", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-1")],
        responses: {
          "req-1": [
            outcomeBy("member-b", "not_hired"),
            outcomeBy("member-c", "not_a_fit"),
          ],
        },
      });
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      expect(text).not.toContain("member-b");
      expect(text).not.toContain("not_hired");
      expect(text).not.toContain("not_a_fit");
      const [referral] = (JSON.parse(text) as { referrals: ListedReferral[] })
        .referrals;
      expect(referral?.hiredBadge).toBe(false);
      expect(referral?.responseCount).toBe(2);
    });
  });

  describe("Referral Coordinator", () => {
    it("lists every Referral for a Coordinator, including ones older than 14 days she never reached out on", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        referrals: [makeReferral("req-open")],
        allReferrals: [
          makeReferral("req-open"),
          makeReferral("req-old", { submitted: daysAgo(30) }),
        ],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        referrals: ListedReferral[];
        showsAllReferrals: boolean;
      };
      expect(body.showsAllReferrals).toBe(true);
      expect(body.referrals.map(referral => referral.id)).toEqual([
        "req-open",
        "req-old",
      ]);
      expect(body.referrals[1]?.isOpen).toBe(false);
      expect(body.referrals[1]).not.toHaveProperty("outreach");
    });

    it("still lists a Coordinator's own reached-out Referral beyond the newest ones", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        allReferrals: [makeReferral("req-recent")],
        respondedReferrals: [
          makeReferral("req-ancient", { submitted: daysAgo(400) }),
        ],
        responses: { "req-ancient": [outreachBy(MEMBER_ID, 399)] },
      });
      const referrals = await listed(await handleRequest(testApp, request));
      expect(referrals.map(referral => referral.id)).toEqual([
        "req-recent",
        "req-ancient",
      ]);
    });

    it("never reveals contact details or other members' names to a Coordinator", async () => {
      const { testApp, request } = setup({
        authToken: "referral-coordinator-token",
        allReferrals: [makeReferral("req-old", { submitted: daysAgo(30) })],
        responses: { "req-old": [outcomeBy("other-member", "not_hired")] },
      });
      const response = await handleRequest(testApp, request);
      const text = await response.text();
      expect(text).not.toContain("Smith");
      expect(text).not.toContain("jane@example.com");
      expect(text).not.toContain("555-0100");
      expect(text).not.toContain("other-member");
    });

    it("keeps an Admin's list to open Referrals (Admins get the panel, not All referrals)", async () => {
      const { testApp, request } = setup({
        authToken: "admin-token",
        referrals: [makeReferral("req-open")],
        allReferrals: [
          makeReferral("req-open"),
          makeReferral("req-old", { submitted: daysAgo(30) }),
        ],
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as {
        referrals: ListedReferral[];
        showsAllReferrals: boolean;
      };
      expect(body.showsAllReferrals).toBe(false);
      expect(body.referrals.map(referral => referral.id)).toEqual(["req-open"]);
    });

    it("returns 500 when every Referral can't be listed for a Coordinator", async () => {
      const testApp = createMembersTestPlugin({
        memberService: {
          findById: mock(() => Promise.resolve(makeActiveStripeMember())),
        },
        referralsService: {
          listAllReferrals: mock(() => Promise.reject(new Error("DB error"))),
        },
      });
      const request = new Request(`http://localhost/${MEMBER_ID}/referrals`, {
        headers: { Authorization: "Bearer referral-coordinator-token" },
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to retrieve referrals");
    });

    it("keeps an ordinary member's list to open Referrals", async () => {
      const { testApp, request } = setup({
        referrals: [makeReferral("req-open")],
        allReferrals: [
          makeReferral("req-open"),
          makeReferral("req-old", { submitted: daysAgo(30) }),
        ],
      });
      const response = await handleRequest(testApp, request);
      const body = (await response.json()) as {
        referrals: ListedReferral[];
        showsAllReferrals: boolean;
      };
      expect(body.showsAllReferrals).toBe(false);
      expect(body.referrals.map(referral => referral.id)).toEqual(["req-open"]);
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
    it("returns 404 when member document not found", async () => {
      const { testApp, request } = setup({ memberNotFound: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(404);
    });

    it("returns 500 on service failure", async () => {
      const { testApp, request } = setup({ serverError: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to retrieve referrals");
    });

    it("returns 500 when listReferrals throws", async () => {
      const mockFindById = mock((): Promise<MemberDocument> =>
        Promise.resolve(makeActiveStripeMember()),
      );
      const testApp = createMembersTestPlugin({
        memberService: { findById: mockFindById },
        referralsService: {
          listReferrals: mock(() => Promise.reject(new Error("DB error"))),
        },
      });
      const request = new Request(`http://localhost/${MEMBER_ID}/referrals`, {
        headers: { Authorization: "Bearer valid-owner-token" },
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to retrieve referrals");
    });
  });
});
