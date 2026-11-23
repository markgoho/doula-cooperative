import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
import type { LegacyOutcomeWrite } from "../services/offline-response/interface.js";
import type { ReferralItem } from "../services/referrals/interface.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const COORDINATOR_ID = "test-member-id";
const REQUEST_ID = "req-abc";
const LEGACY_EMAIL = "lee.legacy@example.com";
const RECORDED_AT = Timestamp.fromDate(new Date("2026-11-20T15:30:00.000Z"));

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
      submitted: Timestamp.now(),
      sent: false,
    },
  };
}

const LEE: LegacyResponseDocument = {
  legacyEmail: LEGACY_EMAIL,
  displayName: "Lee Legacy",
  recordedBy: "other-coordinator",
  recordedAt: RECORDED_AT,
};

function setup({
  method = "PUT",
  memberId = COORDINATOR_ID,
  authToken = "referral-coordinator-token",
  id = toLegacyDoulaId(LEGACY_EMAIL),
  body = { outcome: "hired" },
  legacyResponses = [LEE],
  responses = [],
  referralNotFound = false,
  written = "updated",
}: {
  method?: "PUT" | "DELETE";
  memberId?: string;
  authToken?: string | null;
  id?: string;
  body?: Record<string, unknown>;
  legacyResponses?: LegacyResponseDocument[];
  responses?: MemberResponseDocument[];
  referralNotFound?: boolean;
  written?: LegacyOutcomeWrite;
} = {}) {
  const mockSet = mock(() => Promise.resolve(written));
  const mockClear = mock(() => Promise.resolve(written));
  const now = new Date("2026-11-23T12:00:00.000Z");

  const testApp = createMembersTestPlugin({
    referralsService: {
      getReferral: mock(() =>
        referralNotFound
          ? Promise.reject(new NotFoundError("Referral not found"))
          : Promise.resolve(makeReferral()),
      ),
      listMemberResponses: mock(() => Promise.resolve(responses)),
      listLegacyResponses: mock(() => Promise.resolve(legacyResponses)),
    },
    offlineResponseService: {
      setLegacyOutcome: mockSet,
      clearLegacyOutcome: mockClear,
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const send = () =>
    handleRequest(
      testApp,
      new Request(
        `http://localhost/${memberId}/referrals/${REQUEST_ID}/offline-responses/legacy/${encodeURIComponent(id)}/outcome`,
        {
          method,
          headers,
          ...(method === "PUT" && { body: JSON.stringify(body) }),
        },
      ),
    );

  return { send, mockSet, mockClear, now };
}

interface OutcomeBody {
  outcome?: string;
  outcomeUpdatedAt?: string;
  hiredBadge?: boolean;
  code?: string;
}

describe("PUT and DELETE /:memberId/referrals/:requestId/offline-responses/legacy/:id/outcome", () => {
  describe("Authorization", () => {
    it("returns 401 without an auth header", async () => {
      const { send, mockSet } = setup({ authToken: null });
      const response = await send();
      expect(response.status).toBe(401);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("returns 403 to an ordinary member", async () => {
      const { send, mockSet } = setup({ authToken: "valid-owner-token" });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as OutcomeBody;
      expect(body.code).toBe("REFERRAL_COORDINATOR_REQUIRED");
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("returns 403 to an Admin without the Referral Coordinator claim", async () => {
      const { send, mockSet } = setup({
        authToken: "admin-token",
        memberId: "admin-user",
      });
      const response = await send();
      expect(response.status).toBe(403);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("returns 403 to an Admin on another member's path", async () => {
      const { send, mockClear } = setup({
        method: "DELETE",
        authToken: "admin-token",
      });
      const response = await send();
      expect(response.status).toBe(403);
      expect(mockClear).not.toHaveBeenCalled();
    });
  });

  describe("Setting", () => {
    it("records the Outcome, when, and which Coordinator set it", async () => {
      const { send, mockSet } = setup({ body: { outcome: "not_a_fit" } });
      const response = await send();
      expect(response.status).toBe(200);
      const body = (await response.json()) as OutcomeBody;
      expect(body.outcome).toBe("not_a_fit");
      expect(body.outcomeUpdatedAt).toBeDefined();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: REQUEST_ID,
          legacyEmail: LEGACY_EMAIL,
          outcome: "not_a_fit",
          recordedBy: COORDINATOR_ID,
        }),
        expect.anything(),
      );
    });

    it("shows the hired badge once the doula is hired", async () => {
      const { send } = setup();
      const response = await send();
      const body = (await response.json()) as OutcomeBody;
      expect(body.outcome).toBe("hired");
      expect(body.hiredBadge).toBe(true);
    });

    it("never sends the Legacy Membership's email back", async () => {
      const { send } = setup();
      const response = await send();
      expect(await response.text()).not.toContain(LEGACY_EMAIL);
    });

    it("rejects an unknown Outcome", async () => {
      const { send, mockSet } = setup({ body: { outcome: "maybe" } });
      const response = await send();
      expect(response.status).toBe(422);
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe("Clearing", () => {
    it("clears the Outcome", async () => {
      const { send, mockClear } = setup({ method: "DELETE" });
      const response = await send();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ hiredBadge: false });
      expect(mockClear).toHaveBeenCalledWith(
        { requestId: REQUEST_ID, legacyEmail: LEGACY_EMAIL },
        expect.anything(),
      );
    });

    it("keeps the hired badge when a Member was hired", async () => {
      const { send } = setup({
        method: "DELETE",
        legacyResponses: [{ ...LEE, outcome: "hired" }],
        responses: [
          {
            memberUid: "member-b",
            outreachSentAt: RECORDED_AT,
            outcome: "hired",
          },
        ],
      });
      const response = await send();
      expect(await response.json()).toEqual({ hiredBadge: true });
    });
  });

  describe("Not found", () => {
    it("returns 404 when the Referral doesn't exist", async () => {
      const { send, mockSet } = setup({ referralNotFound: true });
      const response = await send();
      expect(response.status).toBe(404);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("returns 404 OFFLINE_RESPONSE_NOT_FOUND when that doula has no Offline Response", async () => {
      const { send, mockSet } = setup({ legacyResponses: [] });
      const response = await send();
      expect(response.status).toBe(404);
      const body = (await response.json()) as OutcomeBody;
      expect(body.code).toBe("OFFLINE_RESPONSE_NOT_FOUND");
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("never sets a Member's Outcome: a Member's uid finds no Legacy Response", async () => {
      const { send, mockSet } = setup({ id: "member-b" });
      const response = await send();
      expect(response.status).toBe(404);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("returns 404 when the Offline Response is gone by the time it writes", async () => {
      const { send } = setup({ written: "not_found" });
      const response = await send();
      expect(response.status).toBe(404);
      const body = (await response.json()) as OutcomeBody;
      expect(body.code).toBe("OFFLINE_RESPONSE_NOT_FOUND");
    });
  });
});
