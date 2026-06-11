import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const MEMBER_ID = "test-member-id";

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
    serverError?: boolean;
    referrals?: {
      id: string;
      document: {
        name: string;
        phone: string;
        email: string;
        zipcode: string;
        estimatedDueDate: { month: string; day: string; year: string };
        services: string[];
        birthLocation: string;
        otherInfo: string;
        insurance: string[];
        submitted: ReturnType<typeof Timestamp.now>;
        sent: boolean;
      };
    }[];
  }

  function setup({
    memberId = MEMBER_ID,
    authToken = "valid-owner-token",
    memberNotFound = false,
    memberIsInactive = false,
    serverError = false,
    referrals = [],
  }: SetupOptions = {}) {
    const mockFindById = mock((): Promise<MemberDocument> => {
      if (memberNotFound) return Promise.reject(new NotFoundError("Member not found"));
      if (serverError) return Promise.reject(new Error("DB timeout"));
      if (memberIsInactive) return Promise.resolve(makeInactiveMember());
      return Promise.resolve(makeActiveStripeMember());
    });

    const testApp = createMembersTestPlugin({
      memberService: { findById: mockFindById },
      referralsService: {
        listReferrals: mock((_logger) => Promise.resolve(referrals)),
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/referrals`, { headers });
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
    it("returns 200 with empty list for active Stripe owner", async () => {
      const { testApp, request } = setup({ referrals: [] });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { referrals: unknown[] };
      expect(body.referrals).toEqual([]);
    });

    it("returns 200 with referral list items for active Stripe owner", async () => {
      const submitted = Timestamp.now();
      const { testApp, request } = setup({
        referrals: [
          {
            id: "req-abc",
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
        ],
      });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        referrals: {
          id: string;
          zipcode: string;
          services: string[];
          birthLocation: string;
        }[];
      };
      expect(body.referrals).toHaveLength(1);
      expect(body.referrals[0]?.id).toBe("req-abc");
      expect(body.referrals[0]?.zipcode).toBe("14607");
      // Contact info NOT in list response
      expect(body.referrals[0]).not.toHaveProperty("email");
      expect(body.referrals[0]).not.toHaveProperty("name");
      expect(body.referrals[0]).not.toHaveProperty("phone");
    });

    it("returns 200 for admin access even when membership is inactive", async () => {
      const { testApp, request } = setup({ authToken: "admin-token", memberIsInactive: true });
      const response = await handleRequest(testApp, request);
      expect(response.status).toBe(200);
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
