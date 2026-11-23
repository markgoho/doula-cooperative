import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import { toLegacyDoulaId } from "../schemas/to-legacy-doula-id.js";
import type {
  LegacyDoula,
  MemberDoula,
} from "../services/offline-response/interface.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

const MEMBER_ID = "test-member-id";

const MEMBERS: MemberDoula[] = [
  { uid: "member-z", name: "Zoe Doula", email: "zoe@example.com" },
  { uid: "member-a", name: "Ana Doula", email: "ana@example.com" },
  // No name: nothing to pick her by.
  { uid: "member-x", name: "", email: "nameless@example.com" },
];

const LEGACY: LegacyDoula[] = [
  { email: "mia.legacy@example.com", name: "Mia Legacy" },
  // Same doula as a Member: listed once, as the Member.
  { email: "ZOE@example.com", name: "Zoe Doula" },
  { email: "nameless@example.com", name: "Nameless Legacy" },
  { email: "blank@example.com", name: "" },
];

interface DoulasBody {
  doulas: { kind: string; id: string; displayName: string }[];
}

function setup({
  memberId = MEMBER_ID,
  authToken = "referral-coordinator-token",
  readFails = false,
}: {
  memberId?: string;
  authToken?: string | null;
  readFails?: boolean;
} = {}) {
  const mockListMembers = mock(() =>
    readFails
      ? Promise.reject(new Error("Firestore unavailable"))
      : Promise.resolve(MEMBERS),
  );
  const testApp = createMembersTestPlugin({
    offlineResponseService: {
      listMemberDoulas: mockListMembers,
      listUnclaimedLegacyMemberships: mock(() => Promise.resolve(LEGACY)),
    },
  });
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const send = () =>
    handleRequest(
      testApp,
      new Request(`http://localhost/${memberId}/referral-doulas`, { headers }),
    );
  return { send, mockListMembers };
}

describe("GET /:memberId/referral-doulas", () => {
  describe("Authorization", () => {
    it("returns 401 without an auth header", async () => {
      const { send } = setup({ authToken: null });
      const response = await send();
      expect(response.status).toBe(401);
    });

    it("returns 403 to an ordinary member, without reading anyone", async () => {
      const { send, mockListMembers } = setup({
        authToken: "valid-owner-token",
      });
      const response = await send();
      expect(response.status).toBe(403);
      const body = (await response.json()) as { code?: string };
      expect(body.code).toBe("REFERRAL_COORDINATOR_REQUIRED");
      expect(mockListMembers).not.toHaveBeenCalled();
    });

    it("returns 403 to an Admin without the Referral Coordinator claim", async () => {
      const { send } = setup({
        authToken: "admin-token",
        memberId: "admin-user",
      });
      const response = await send();
      expect(response.status).toBe(403);
    });

    it("returns 403 to an Admin on a Coordinator's path", async () => {
      const { send } = setup({ authToken: "admin-token" });
      const response = await send();
      expect(response.status).toBe(403);
    });
  });

  describe("Success", () => {
    it("lists Members and Unclaimed Legacy Memberships by name, with display name and id only", async () => {
      const { send } = setup();
      const response = await send();
      expect(response.status).toBe(200);
      const body = (await response.json()) as DoulasBody;
      expect(body.doulas).toEqual([
        { kind: "member", id: "member-a", displayName: "Ana Doula" },
        {
          kind: "legacy",
          id: toLegacyDoulaId("mia.legacy@example.com"),
          displayName: "Mia Legacy",
        },
        { kind: "member", id: "member-z", displayName: "Zoe Doula" },
      ]);
    });

    it("never sends an email address", async () => {
      const { send } = setup();
      const response = await send();
      const text = await response.text();
      expect(text).not.toContain("@");
    });
  });

  it("returns 500 when the doulas can't be read", async () => {
    const { send } = setup({ readFails: true });
    const response = await send();
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("Failed to load the doula list. Please try again.");
  });
});
