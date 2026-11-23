import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
import type {
  OfflineResponseRecording,
  OfflineResponseService,
} from "../services/offline-response/interface.js";
import type { ReferralItem } from "../services/referrals/interface.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const COORDINATOR_ID = "test-member-id";
const REQUEST_ID = "req-abc";
const DOULA_ID = "member-b";
const LEGACY_EMAIL = "lee.legacy@example.com";
const LEGACY_ID = toLegacyDoulaId(LEGACY_EMAIL);

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
      // Older than 14 days: the Coordinator records on any Referral.
      submitted: Timestamp.fromDate(new Date("2026-09-01T00:00:00.000Z")),
      sent: false,
    },
  };
}

interface RowBody {
  offlineResponse: Record<string, unknown>;
}

interface ErrorBody {
  error: string;
  code?: string;
}

function setup({
  memberId = COORDINATOR_ID,
  authToken = "referral-coordinator-token",
  body = { kind: "member", id: DOULA_ID },
  referralNotFound = false,
  memberNotFound = false,
  memberResult = "recorded",
  legacyResult = "recorded",
  writeFails = false,
}: {
  memberId?: string;
  authToken?: string | null;
  body?: unknown;
  referralNotFound?: boolean;
  memberNotFound?: boolean;
  memberResult?: OfflineResponseRecording;
  legacyResult?: Exclude<OfflineResponseRecording, "has_outreach">;
  writeFails?: boolean;
} = {}) {
  const mockRecordMember = mock<
    OfflineResponseService["recordMemberOfflineResponse"]
  >(() =>
    writeFails
      ? Promise.reject(new Error("Firestore unavailable"))
      : Promise.resolve(memberResult),
  );
  const mockRecordLegacy = mock<
    OfflineResponseService["recordLegacyOfflineResponse"]
  >(() => Promise.resolve(legacyResult));

  const testApp = createMembersTestPlugin({
    memberService: {
      findById: mock((uid: string) =>
        memberNotFound
          ? Promise.reject(new NotFoundError("Member not found"))
          : Promise.resolve({ uid, name: " Bea Doula " } as MemberDocument),
      ),
      findNamesByIds: mock(() =>
        Promise.resolve(new Map([[COORDINATOR_ID, "Dana Coordinator"]])),
      ),
    },
    referralsService: {
      getReferral: mock(() =>
        referralNotFound
          ? Promise.reject(new NotFoundError("Referral not found"))
          : Promise.resolve(makeReferral()),
      ),
    },
    offlineResponseService: {
      listUnclaimedLegacyMemberships: mock(() =>
        Promise.resolve([{ email: LEGACY_EMAIL, name: "Lee Legacy" }]),
      ),
      recordMemberOfflineResponse: mockRecordMember,
      recordLegacyOfflineResponse: mockRecordLegacy,
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
        `http://localhost/${memberId}/referrals/${REQUEST_ID}/offline-responses`,
        { method: "POST", headers, body: JSON.stringify(body) },
      ),
    );

  return { send, mockRecordMember, mockRecordLegacy };
}

describe("POST /:memberId/referrals/:requestId/offline-responses", () => {
  describe("Authorization", () => {
    it("returns 401 without an auth header", async () => {
      const { send, mockRecordMember } = setup({ authToken: null });
      const response = await send();
      expect(response.status).toBe(401);
      expect(mockRecordMember).not.toHaveBeenCalled();
    });

    it("returns 403 to an ordinary member", async () => {
      const { send, mockRecordMember } = setup({
        authToken: "valid-owner-token",
      });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("REFERRAL_COORDINATOR_REQUIRED");
      expect(mockRecordMember).not.toHaveBeenCalled();
    });

    it("returns 403 to an Admin without the Referral Coordinator claim", async () => {
      const { send, mockRecordMember } = setup({
        authToken: "admin-token",
        memberId: "admin-user",
      });
      const response = await send();
      expect(response.status).toBe(403);
      expect(mockRecordMember).not.toHaveBeenCalled();
    });
  });

  describe("Member", () => {
    it("records it with who and when, on a Referral of any age, and returns the row", async () => {
      const { send, mockRecordMember } = setup();
      const response = await send();
      expect(response.status).toBe(201);
      const [record] = mockRecordMember.mock.calls[0] ?? [];
      expect(record).toMatchObject({
        requestId: REQUEST_ID,
        memberUid: DOULA_ID,
        recordedBy: COORDINATOR_ID,
      });
      const body = (await response.json()) as RowBody;
      expect(body.offlineResponse).toEqual({
        kind: "member",
        id: DOULA_ID,
        displayName: "Bea Doula",
        recordedAt: expect.any(String) as string,
        recordedByName: "Dana Coordinator",
        canDelete: true,
      });
    });

    it("refuses a Member who already sent Outreach on this Referral", async () => {
      const { send } = setup({ memberResult: "has_outreach" });
      const response = await send();
      expect(response.status).toBe(409);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OFFLINE_RESPONSE_HAS_OUTREACH");
    });

    it("refuses a second Offline Response for the same Member", async () => {
      const { send } = setup({ memberResult: "already_recorded" });
      const response = await send();
      expect(response.status).toBe(409);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OFFLINE_RESPONSE_ALREADY_RECORDED");
    });

    it("returns 404 for an unknown Member", async () => {
      const { send, mockRecordMember } = setup({ memberNotFound: true });
      const response = await send();
      expect(response.status).toBe(404);
      expect(mockRecordMember).not.toHaveBeenCalled();
    });
  });

  describe("Unclaimed Legacy Membership", () => {
    it("records it by email with the name, and returns the opaque id only", async () => {
      const { send, mockRecordLegacy } = setup({
        body: { kind: "legacy", id: LEGACY_ID },
      });
      const response = await send();
      expect(response.status).toBe(201);
      const [record] = mockRecordLegacy.mock.calls[0] ?? [];
      expect(record).toMatchObject({
        requestId: REQUEST_ID,
        legacyEmail: LEGACY_EMAIL,
        displayName: "Lee Legacy",
        recordedBy: COORDINATOR_ID,
      });
      const text = await response.text();
      expect(text).not.toContain(LEGACY_EMAIL);
      const body = JSON.parse(text) as RowBody;
      expect(body.offlineResponse).toMatchObject({
        kind: "legacy",
        id: LEGACY_ID,
        displayName: "Lee Legacy",
      });
    });

    it("refuses a second Offline Response for the same Legacy Membership", async () => {
      const { send } = setup({
        body: { kind: "legacy", id: LEGACY_ID },
        legacyResult: "already_recorded",
      });
      const response = await send();
      expect(response.status).toBe(409);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("OFFLINE_RESPONSE_ALREADY_RECORDED");
    });

    it("returns 404 DOULA_NOT_FOUND for an id that matches no Legacy Membership", async () => {
      const { send, mockRecordLegacy } = setup({
        body: { kind: "legacy", id: toLegacyDoulaId("gone@example.com") },
      });
      const response = await send();
      expect(response.status).toBe(404);
      const body = (await response.json()) as ErrorBody;
      expect(body.code).toBe("DOULA_NOT_FOUND");
      expect(mockRecordLegacy).not.toHaveBeenCalled();
    });

    it("doesn't accept an email as the id", async () => {
      const { send } = setup({ body: { kind: "legacy", id: LEGACY_EMAIL } });
      const response = await send();
      expect(response.status).toBe(404);
    });
  });

  describe("Validation and errors", () => {
    it("returns 422 for an unknown kind", async () => {
      const { send } = setup({ body: { kind: "friend", id: DOULA_ID } });
      const response = await send();
      expect(response.status).toBe(422);
    });

    it("returns 422 without an id", async () => {
      const { send } = setup({ body: { kind: "member" } });
      const response = await send();
      expect(response.status).toBe(422);
    });

    it("returns 404 when the Referral doesn't exist", async () => {
      const { send, mockRecordMember } = setup({ referralNotFound: true });
      const response = await send();
      expect(response.status).toBe(404);
      expect(mockRecordMember).not.toHaveBeenCalled();
    });

    it("returns 500 when the write fails", async () => {
      const { send } = setup({ writeFails: true });
      const response = await send();
      expect(response.status).toBe(500);
      const body = (await response.json()) as ErrorBody;
      expect(body.error).toBe(
        "Failed to save the Offline Response. Please try again.",
      );
    });
  });
});
