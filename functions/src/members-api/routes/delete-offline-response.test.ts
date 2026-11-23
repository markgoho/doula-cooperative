import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { createMockVerifyOwnerOrAdmin } from "../../test-utils/auth-mocks.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
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

function memberOffline(recordedBy: string): MemberResponseDocument {
  return {
    memberUid: "member-b",
    offlineResponse: { recordedBy, recordedAt: RECORDED_AT },
  };
}

function legacyOffline(recordedBy: string): LegacyResponseDocument {
  return {
    legacyEmail: LEGACY_EMAIL,
    displayName: "Lee Legacy",
    recordedBy,
    recordedAt: RECORDED_AT,
  };
}

/** A Referral Coordinator who is also an Admin, on her own path. */
const ADMIN_COORDINATOR_TOKEN = "admin-coordinator-token";

function setup({
  memberId = COORDINATOR_ID,
  authToken = "referral-coordinator-token",
  kind = "member",
  id = "member-b",
  responses = [memberOffline(COORDINATOR_ID)],
  legacyResponses = [legacyOffline(COORDINATOR_ID)],
  referralNotFound = false,
}: {
  memberId?: string;
  authToken?: string | null;
  kind?: string;
  id?: string;
  responses?: MemberResponseDocument[];
  legacyResponses?: LegacyResponseDocument[];
  referralNotFound?: boolean;
} = {}) {
  const mockDeleteMember = mock(() => Promise.resolve());
  const mockDeleteLegacy = mock(() => Promise.resolve());
  const verifyOwnerOrAdmin = createMockVerifyOwnerOrAdmin();

  const testApp = createMembersTestPlugin({
    authService: {
      verifyOwnerOrAdmin: mock(
        (header: string | undefined, pathMemberId: string) =>
          header === `Bearer ${ADMIN_COORDINATOR_TOKEN}`
            ? Promise.resolve({
                uid: COORDINATOR_ID,
                admin: true,
                referralCoordinator: true,
              } as unknown as DecodedIdToken)
            : verifyOwnerOrAdmin(header, pathMemberId),
      ),
    },
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
      deleteMemberOfflineResponse: mockDeleteMember,
      deleteLegacyOfflineResponse: mockDeleteLegacy,
    },
  });

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const send = () =>
    handleRequest(
      testApp,
      new Request(
        `http://localhost/${memberId}/referrals/${REQUEST_ID}/offline-responses/${kind}/${encodeURIComponent(id)}`,
        { method: "DELETE", headers },
      ),
    );

  return { send, mockDeleteMember, mockDeleteLegacy };
}

describe("DELETE /:memberId/referrals/:requestId/offline-responses/:kind/:id", () => {
  describe("Authorization", () => {
    it("returns 401 without an auth header", async () => {
      const { send, mockDeleteMember } = setup({ authToken: null });
      const response = await send();
      expect(response.status).toBe(401);
      expect(mockDeleteMember).not.toHaveBeenCalled();
    });

    it("returns 403 to an ordinary member", async () => {
      const { send, mockDeleteMember } = setup({
        authToken: "valid-owner-token",
      });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as { code?: string };
      expect(body.code).toBe("REFERRAL_COORDINATOR_REQUIRED");
      expect(mockDeleteMember).not.toHaveBeenCalled();
    });

    it("returns 403 to an Admin without the Referral Coordinator claim", async () => {
      const { send, mockDeleteMember } = setup({
        authToken: "admin-token",
        memberId: "admin-user",
      });
      const response = await send();
      expect(response.status).toBe(403);
      expect(mockDeleteMember).not.toHaveBeenCalled();
    });

    it("refuses to delete one another Coordinator recorded", async () => {
      const { send, mockDeleteMember } = setup({
        responses: [memberOffline("other-coordinator")],
      });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as { code?: string };
      expect(body.code).toBe("OFFLINE_RESPONSE_NOT_YOURS");
      expect(mockDeleteMember).not.toHaveBeenCalled();
    });

    it("lets a Coordinator who is also an Admin delete one another Coordinator recorded", async () => {
      const { send, mockDeleteMember } = setup({
        authToken: ADMIN_COORDINATOR_TOKEN,
        responses: [memberOffline("other-coordinator")],
      });
      const response = await send();
      expect(response.status).toBe(200);
      expect(mockDeleteMember).toHaveBeenCalledTimes(1);
    });
  });

  describe("Deleting", () => {
    it("deletes a Member's Offline Response she recorded", async () => {
      const { send, mockDeleteMember } = setup();
      const response = await send();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: true });
      expect(mockDeleteMember).toHaveBeenCalledWith(
        { requestId: REQUEST_ID, memberUid: "member-b" },
        expect.anything(),
      );
    });

    it("deletes a Legacy Membership's Offline Response by its opaque id", async () => {
      const { send, mockDeleteLegacy } = setup({
        kind: "legacy",
        id: toLegacyDoulaId(LEGACY_EMAIL),
      });
      const response = await send();
      expect(response.status).toBe(200);
      expect(mockDeleteLegacy).toHaveBeenCalledWith(
        { requestId: REQUEST_ID, legacyEmail: LEGACY_EMAIL },
        expect.anything(),
      );
    });

    it("returns 404 OFFLINE_RESPONSE_NOT_FOUND when there is none for that doula", async () => {
      const { send, mockDeleteMember } = setup({
        responses: [{ memberUid: "member-b", outreachSentAt: RECORDED_AT }],
      });
      const response = await send();
      expect(response.status).toBe(404);
      const body = (await response.json()) as { code?: string };
      expect(body.code).toBe("OFFLINE_RESPONSE_NOT_FOUND");
      expect(mockDeleteMember).not.toHaveBeenCalled();
    });

    it("returns 404 for a legacy id that matches none on this Referral", async () => {
      const { send, mockDeleteLegacy } = setup({
        kind: "legacy",
        id: toLegacyDoulaId("someone-else@example.com"),
      });
      const response = await send();
      expect(response.status).toBe(404);
      expect(mockDeleteLegacy).not.toHaveBeenCalled();
    });

    it("returns 404 when the Referral doesn't exist", async () => {
      const { send } = setup({ referralNotFound: true });
      const response = await send();
      expect(response.status).toBe(404);
    });

    it("returns 422 for an unknown kind", async () => {
      const { send } = setup({ kind: "friend" });
      const response = await send();
      expect(response.status).toBe(422);
    });
  });
});
