import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
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

function makeReferralItem(id = REQUEST_ID): ReferralItem {
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
    },
  };
}

describe("GET /:memberId/referrals/:requestId", () => {
  interface SetupOptions {
    memberId?: string;
    requestId?: string;
    authToken?: string | null;
    memberIsInactive?: boolean;
    referralNotFound?: boolean;
  }

  function setup({
    memberId = MEMBER_ID,
    requestId = REQUEST_ID,
    authToken = "valid-owner-token",
    memberIsInactive = false,
    referralNotFound = false,
  }: SetupOptions = {}) {
    const mockFindById = mock((): Promise<MemberDocument> => {
      if (memberIsInactive) return Promise.resolve(makeInactiveMember());
      return Promise.resolve(makeActiveStripeMember());
    });

    const mockGetReferral = mock((id: string, _logger): Promise<ReferralItem> => {
      if (referralNotFound || id !== REQUEST_ID) {
        return Promise.reject(new NotFoundError(`Referral ${id} not found`));
      }
      return Promise.resolve(makeReferralItem(id));
    });

    const testApp = createMembersTestPlugin({
      memberService: { findById: mockFindById },
      referralsService: { getReferral: mockGetReferral },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(
      `http://localhost/${memberId}/referrals/${requestId}`,
      { headers },
    );
    return { testApp, request };
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
    it("returns 200 with full detail including contact info", async () => {
      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        id: string;
        name: string;
        email: string;
        phone: string;
        zipcode: string;
        services: string[];
        birthLocation: string;
        otherInfo: string;
        insurance: string[];
        submitted: string;
      };
      expect(body.id).toBe(REQUEST_ID);
      expect(body.name).toBe("Jane Smith");
      expect(body.email).toBe("jane@example.com");
      expect(body.phone).toBe("555-0100");
      expect(body.zipcode).toBe("14607");
      expect(body.services).toContain("birth-doula");
      expect(body.birthLocation).toBe("Hospital");
      expect(body.otherInfo).toBe("Looking for experienced doula");
      expect(typeof body.submitted).toBe("string");
    });

    it("returns 200 for admin access", async () => {
      const { testApp, request } = setup({ authToken: "admin-token" });
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
});
