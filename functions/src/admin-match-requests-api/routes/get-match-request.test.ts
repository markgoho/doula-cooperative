import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type {
  MatchRequestDetailResponse,
  MatchRequestResponse,
} from "../schemas/match-request-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

const at = (iso: string) => Timestamp.fromDate(new Date(iso));

/** A Referral with every kind of response, deliberately out of order. */
const MIXED_MEMBER_RESPONSES: MemberResponseDocument[] = [
  {
    memberUid: "member-offline",
    offlineResponse: {
      recordedBy: "coordinator-1",
      recordedAt: at("2026-03-03T10:00:00.000Z"),
    },
    outcome: "not_a_fit",
    outcomeUpdatedAt: at("2026-03-05T10:00:00.000Z"),
  },
  {
    memberUid: "member-outreach",
    outreachSentAt: at("2026-03-01T10:00:00.000Z"),
    outcome: "hired",
    outcomeUpdatedAt: at("2026-03-04T10:00:00.000Z"),
  },
  {
    memberUid: "member-pending",
    outreachPendingAt: at("2026-03-02T10:00:00.000Z"),
  },
  {
    memberUid: "member-both",
    outreachSentAt: at("2026-03-02T12:00:00.000Z"),
    offlineResponse: {
      recordedBy: "coordinator-1",
      recordedAt: at("2026-03-02T09:00:00.000Z"),
    },
  },
];

const MIXED_LEGACY_RESPONSES: LegacyResponseDocument[] = [
  {
    legacyEmail: "later@example.com",
    displayName: "Later Legacy",
    recordedBy: "coordinator-2",
    recordedAt: at("2026-03-07T10:00:00.000Z"),
  },
  {
    legacyEmail: "legacy@example.com",
    displayName: "Legacy Doula",
    recordedBy: "coordinator-1",
    recordedAt: at("2026-03-06T10:00:00.000Z"),
  },
];

const NAMES = new Map([
  ["member-offline", "Olive Offline"],
  ["member-outreach", "Oscar Outreach"],
  ["member-both", "Bea Both"],
  ["coordinator-1", "Cora Coordinator"],
]);

/**
 * Tests for GET /:requestId (get single match request).
 * Served at /api/admin/match-requests/:requestId via Firebase rewrite.
 */
describe("GET /:requestId (get match request)", () => {
  interface SetupOptions {
    // Request parameters
    requestId?: string;
    authToken?: string | null;

    // Scenario data
    memberResponses?: MemberResponseDocument[];
    legacyResponses?: LegacyResponseDocument[];
    names?: Map<string, string>;

    // Scenario flags
    requestNotFound?: boolean;
  }

  function setup({
    requestId = "request-123",
    authToken = "admin-token",
    memberResponses = [],
    legacyResponses = [],
    names = new Map<string, string>(),
    requestNotFound = false,
  }: SetupOptions = {}) {
    const mockRequest: MatchRequestResponse = {
      id: requestId,
      name: "Test User",
      phone: "555-1234",
      email: "test@example.com",
      zipcode: "12345",
      estimatedDueDate: { month: "03", day: "15", year: "2025" },
      services: ["birth-doula"],
      birthLocation: "Hospital",
      otherInfo: "First time",
      insurance: ["Blue Cross"],
      submitted: new Date().toISOString(),
      sent: false,
    };

    // Configure mock based on scenario
    const mockGetMatchRequest = mock(() => {
      if (requestNotFound) {
        throw new NotFoundError("Match request not found");
      }
      return Promise.resolve(mockRequest);
    });
    const mockFindMemberNamesByIds = mock((memberIds: string[]) =>
      Promise.resolve(
        new Map(
          memberIds.flatMap(memberId => {
            const name = names.get(memberId);
            return name ? [[memberId, name] as const] : [];
          }),
        ),
      ),
    );

    const testApp = createAdminTestPlugin({
      matchRequestAdminService: {
        getMatchRequest: mockGetMatchRequest,
        listMemberResponses: mock(() => Promise.resolve(memberResponses)),
        listLegacyResponses: mock(() => Promise.resolve(legacyResponses)),
        findMemberNamesByIds: mockFindMemberNamesByIds,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${requestId}`, {
      headers,
    });

    return { testApp, request, mockRequest, mockFindMemberNamesByIds };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Success Scenarios", () => {
    it("should return match request with no responses when none recorded", async () => {
      const { testApp, request, mockRequest } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as MatchRequestDetailResponse;
      expect(body).toEqual({
        ...mockRequest,
        responses: { members: [], legacy: [] },
      });
    });

    it("should list Outreach, Referral Outcomes, and Offline Responses for mixed responses", async () => {
      const { testApp, request } = setup({
        memberResponses: MIXED_MEMBER_RESPONSES,
        legacyResponses: MIXED_LEGACY_RESPONSES,
        names: NAMES,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as MatchRequestDetailResponse;
      expect(body.responses).toEqual({
        members: [
          {
            memberUid: "member-outreach",
            memberName: "Oscar Outreach",
            outreachSentAt: "2026-03-01T10:00:00.000Z",
            outcome: "hired",
            outcomeUpdatedAt: "2026-03-04T10:00:00.000Z",
          },
          {
            memberUid: "member-both",
            memberName: "Bea Both",
            outreachSentAt: "2026-03-02T12:00:00.000Z",
            offlineResponse: {
              recordedByName: "Cora Coordinator",
              recordedAt: "2026-03-02T09:00:00.000Z",
            },
          },
          {
            memberUid: "member-offline",
            memberName: "Olive Offline",
            outcome: "not_a_fit",
            outcomeUpdatedAt: "2026-03-05T10:00:00.000Z",
            offlineResponse: {
              recordedByName: "Cora Coordinator",
              recordedAt: "2026-03-03T10:00:00.000Z",
            },
          },
        ],
        legacy: [
          {
            displayName: "Legacy Doula",
            recordedByName: "Cora Coordinator",
            recordedAt: "2026-03-06T10:00:00.000Z",
          },
          {
            displayName: "Later Legacy",
            recordedByName: "",
            recordedAt: "2026-03-07T10:00:00.000Z",
          },
        ],
      });
    });

    it("should leave out a Member whose Outreach is still in flight", async () => {
      const { testApp, request, mockFindMemberNamesByIds } = setup({
        memberResponses: [
          {
            memberUid: "member-pending",
            outreachPendingAt: at("2026-03-02T10:00:00.000Z"),
          },
        ],
      });

      const response = await handleRequest(testApp, request);

      const body = (await response.json()) as MatchRequestDetailResponse;
      expect(body.responses).toEqual({ members: [], legacy: [] });
      expect(mockFindMemberNamesByIds).toHaveBeenCalledWith([]);
    });

    it("should never expose a Legacy Membership's email", async () => {
      const { testApp, request } = setup({
        legacyResponses: MIXED_LEGACY_RESPONSES,
      });

      const response = await handleRequest(testApp, request);

      expect(await response.text()).not.toContain("legacy@example.com");
    });

    it("should return an empty name when a Member can't be found", async () => {
      const { testApp, request } = setup({
        memberResponses: [
          {
            memberUid: "deleted-member",
            outreachSentAt: at("2026-03-01T10:00:00.000Z"),
          },
        ],
      });

      const response = await handleRequest(testApp, request);

      const body = (await response.json()) as MatchRequestDetailResponse;
      expect(body.responses.members).toEqual([
        {
          memberUid: "deleted-member",
          memberName: "",
          outreachSentAt: "2026-03-01T10:00:00.000Z",
        },
      ]);
    });
  });

  describe("Error Scenarios", () => {
    it("should return 404 when match request not found", async () => {
      const { testApp, request } = setup({
        requestId: "nonexistent-id",
        requestNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Match request not found");
    });
  });
});
