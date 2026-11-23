import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type {
  MemberResponseDocument,
  ReferralOutcome,
} from "../../collections/member-responses.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import type { ReferralOutcomeService } from "../services/referral-outcome/interface.js";
import type { ReferralItem } from "../services/referrals/interface.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const MEMBER_ID = "test-member-id";
const REQUEST_ID = "req-abc";
const DAY_MS = 24 * 60 * 60 * 1000;
const SENT_AT = Timestamp.fromDate(new Date("2026-11-20T15:30:00.000Z"));
const EARLIER = Timestamp.fromDate(new Date("2026-11-21T09:00:00.000Z"));

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

function makeReferral(): ReferralItem {
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
      submitted: Timestamp.fromMillis(Date.now() - 40 * DAY_MS),
      sent: false,
    },
  };
}

function outreachBy(
  memberUid: string,
  overrides: Partial<MemberResponseDocument> = {},
): MemberResponseDocument {
  return { memberUid, outreachSentAt: SENT_AT, ...overrides };
}

interface OutcomeBody {
  outcome?: ReferralOutcome;
  outcomeUpdatedAt?: string;
  hiredBadge: boolean;
}

interface ErrorBody {
  error: string;
  code?: string;
}

function setup({
  method = "PUT",
  memberId = MEMBER_ID,
  authToken = "valid-owner-token",
  outcome = "hired",
  body,
  member = makeMember(),
  v2Enabled = true,
  referralNotFound = false,
  responses = [outreachBy(MEMBER_ID)],
  writeFails = false,
}: {
  method?: "PUT" | "DELETE";
  memberId?: string;
  authToken?: string | null;
  outcome?: string;
  body?: unknown;
  member?: MemberDocument;
  v2Enabled?: boolean;
  referralNotFound?: boolean;
  responses?: MemberResponseDocument[];
  writeFails?: boolean;
} = {}) {
  const write = () =>
    writeFails
      ? Promise.reject(new Error("Firestore unavailable"))
      : Promise.resolve();
  const mockSetOutcome = mock<ReferralOutcomeService["setOutcome"]>(write);
  const mockClearOutcome = mock<ReferralOutcomeService["clearOutcome"]>(write);

  const testApp = createMembersTestPlugin({
    memberService: { findById: mock(() => Promise.resolve(member)) },
    referralsService: {
      getReferral: mock(() =>
        referralNotFound
          ? Promise.reject(new NotFoundError("Referral not found"))
          : Promise.resolve(makeReferral()),
      ),
      listMemberResponses: mock(() => Promise.resolve(responses)),
    },
    referralPortalSettingsService: {
      getReferralPortalSettings: mock(() => Promise.resolve({ v2Enabled })),
    },
    referralOutcomeService: {
      setOutcome: mockSetOutcome,
      clearOutcome: mockClearOutcome,
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const request = new Request(
    `http://localhost/${memberId}/referrals/${REQUEST_ID}/outcome`,
    method === "PUT"
      ? { method, headers, body: JSON.stringify(body ?? { outcome }) }
      : { method, headers },
  );

  const send = () => handleRequest(testApp, request);

  /** The server time the route stamped on the stored Outcome. */
  function storedUpdatedAt(): Date {
    const [target] = mockSetOutcome.mock.calls[0] ?? [];
    if (!target) throw new Error("No Outcome was stored");
    return target.updatedAt;
  }

  return { send, mockSetOutcome, mockClearOutcome, storedUpdatedAt };
}

describe("PUT /:memberId/referrals/:requestId/outcome", () => {
  describe("Authentication", () => {
    it("returns 401 without an auth header", async () => {
      const { send, mockSetOutcome } = setup({ authToken: null });
      const response = await send();
      expect(response.status).toBe(401);
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });

    it("returns 403 for another member's path", async () => {
      const { send, mockSetOutcome } = setup({ authToken: "non-owner-token" });
      const response = await send();
      expect(response.status).toBe(403);
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });

    it("doesn't let an Admin record an Outcome for a member", async () => {
      const { send, mockSetOutcome } = setup({ authToken: "admin-token" });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OUTCOME_NOT_SELF");
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });

    it("lets an Admin record their own Outcome after their own Outreach", async () => {
      const { send, mockSetOutcome } = setup({
        authToken: "admin-token",
        memberId: "admin-user",
        responses: [outreachBy("admin-user")],
      });
      const response = await send();
      expect(response.status).toBe(200);
      expect(mockSetOutcome).toHaveBeenCalledTimes(1);
    });
  });

  describe("Eligibility", () => {
    it("returns 403 to a member without an active membership", async () => {
      const { send, mockSetOutcome } = setup({
        member: makeMember({
          membershipActive: false,
          subscriptionStatus: "canceled",
        }),
      });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("ACTIVE_MEMBERSHIP_REQUIRED");
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });

    it("returns 403 REFERRAL_PORTAL_DISABLED while the switch is off", async () => {
      const { send } = setup({ v2Enabled: false });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("REFERRAL_PORTAL_DISABLED");
    });
  });

  describe("Requires the member's own Outreach", () => {
    it("returns 403 OUTCOME_REQUIRES_OUTREACH when the member never reached out", async () => {
      const { send, mockSetOutcome } = setup({ responses: [] });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OUTCOME_REQUIRES_OUTREACH");
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });

    it("returns 403 while the member's Outreach is still sending", async () => {
      const { send, mockSetOutcome } = setup({
        responses: [
          { memberUid: MEMBER_ID, outreachPendingAt: Timestamp.now() },
        ],
      });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OUTCOME_REQUIRES_OUTREACH");
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });

    it("returns 403 when only other members reached out", async () => {
      const { send } = setup({ responses: [outreachBy("member-b")] });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OUTCOME_REQUIRES_OUTREACH");
    });
  });

  describe("Recording", () => {
    it("stores the Outcome with the server time and returns it", async () => {
      const before = Date.now();
      const { send, mockSetOutcome, storedUpdatedAt } = setup({
        outcome: "not_hired",
      });
      const response = await send();
      expect(response.status).toBe(200);
      const updatedAt = storedUpdatedAt();
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(await response.json()).toEqual({
        outcome: "not_hired",
        outcomeUpdatedAt: updatedAt.toISOString(),
        hiredBadge: false,
      });
      expect(mockSetOutcome).toHaveBeenCalledWith(
        {
          requestId: REQUEST_ID,
          memberUid: MEMBER_ID,
          outcome: "not_hired",
          updatedAt,
        },
        expect.anything(),
      );
    });

    it("changes an existing Outcome and updates its time", async () => {
      const { send, storedUpdatedAt } = setup({
        outcome: "hired",
        responses: [
          outreachBy(MEMBER_ID, {
            outcome: "not_a_fit",
            outcomeUpdatedAt: EARLIER,
          }),
        ],
      });
      const response = await send();
      expect(response.status).toBe(200);
      const body = (await response.json()) as OutcomeBody;
      expect(body).toEqual({
        outcome: "hired",
        outcomeUpdatedAt: storedUpdatedAt().toISOString(),
        hiredBadge: true,
      });
      expect(body.outcomeUpdatedAt).not.toBe(EARLIER.toDate().toISOString());
    });

    it("records an Outcome on a Referral older than 14 days", async () => {
      // makeReferral() was submitted 40 days ago.
      const { send } = setup();
      const response = await send();
      expect(response.status).toBe(200);
    });

    it("keeps the hired badge from another member when recording not hired", async () => {
      const { send } = setup({
        outcome: "not_hired",
        responses: [
          outreachBy(MEMBER_ID),
          outreachBy("member-b", {
            outcome: "hired",
            outcomeUpdatedAt: EARLIER,
          }),
        ],
      });
      const response = await send();
      const text = await response.text();
      expect((JSON.parse(text) as OutcomeBody).hiredBadge).toBe(true);
      expect(text).not.toContain("member-b");
    });
  });

  describe("Validation", () => {
    it.each([["claimed"], ["Hired"], [""]])(
      "rejects the unknown Outcome %p",
      async outcome => {
        const { send, mockSetOutcome } = setup({ outcome });
        const response = await send();
        expect(response.status).toBe(422);
        expect(mockSetOutcome).not.toHaveBeenCalled();
      },
    );

    it("rejects a body without an Outcome", async () => {
      const { send, mockSetOutcome } = setup({ body: {} });
      const response = await send();
      expect(response.status).toBe(422);
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("returns 404 when the Referral doesn't exist", async () => {
      const { send, mockSetOutcome } = setup({ referralNotFound: true });
      const response = await send();
      expect(response.status).toBe(404);
      expect(mockSetOutcome).not.toHaveBeenCalled();
    });

    it("returns 500 when the Outcome can't be saved", async () => {
      const { send } = setup({ writeFails: true });
      const response = await send();
      expect(response.status).toBe(500);
      const body = (await response.json()) as ErrorBody;
      expect(body.error).toBe("Failed to save your outcome. Please try again.");
    });
  });
});

describe("DELETE /:memberId/referrals/:requestId/outcome", () => {
  it("clears the member's Outcome and its time", async () => {
    const { send, mockClearOutcome } = setup({
      method: "DELETE",
      responses: [
        outreachBy(MEMBER_ID, { outcome: "hired", outcomeUpdatedAt: EARLIER }),
      ],
    });
    const response = await send();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hiredBadge: false });
    expect(mockClearOutcome).toHaveBeenCalledWith(
      { requestId: REQUEST_ID, memberUid: MEMBER_ID },
      expect.anything(),
    );
  });

  it("succeeds when no Outcome is set", async () => {
    const { send, mockClearOutcome } = setup({ method: "DELETE" });
    const response = await send();
    expect(response.status).toBe(200);
    expect(mockClearOutcome).toHaveBeenCalledTimes(1);
  });

  it("keeps the hired badge when another member was hired", async () => {
    const { send } = setup({
      method: "DELETE",
      responses: [
        outreachBy(MEMBER_ID, { outcome: "hired", outcomeUpdatedAt: EARLIER }),
        outreachBy("member-b", { outcome: "hired", outcomeUpdatedAt: EARLIER }),
      ],
    });
    const response = await send();
    expect(await response.json()).toEqual({ hiredBadge: true });
  });

  it("returns 403 OUTCOME_REQUIRES_OUTREACH without the member's Outreach", async () => {
    const { send, mockClearOutcome } = setup({
      method: "DELETE",
      responses: [],
    });
    const response = await send();
    expect(response.status).toBe(403);
    const body = (await response.json()) as ErrorBody;
    expect(body.code).toBe("OUTCOME_REQUIRES_OUTREACH");
    expect(mockClearOutcome).not.toHaveBeenCalled();
  });

  it("doesn't let an Admin clear a member's Outcome", async () => {
    const { send, mockClearOutcome } = setup({
      method: "DELETE",
      authToken: "admin-token",
    });
    const response = await send();
    expect(response.status).toBe(403);
    const body = (await response.json()) as ErrorBody;
    expect(body.code).toBe("OUTCOME_NOT_SELF");
    expect(mockClearOutcome).not.toHaveBeenCalled();
  });
});
