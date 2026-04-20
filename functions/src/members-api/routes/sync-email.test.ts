import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

describe("POST /:memberId/sync-email (authenticated)", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    authEmail?: string;
    firestoreEmail?: string;
    memberExists?: boolean;
    forbidden?: boolean;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    authEmail = "new@example.com",
    firestoreEmail = "old@example.com",
    memberExists = true,
    forbidden = false,
  }: SetupOptions = {}) {
    const getMemberByUid = mock(() =>
      Promise.resolve({
        exists: memberExists,
        data: () => ({ email: firestoreEmail }),
      } as unknown as DocumentSnapshot),
    );
    const updateMember = mock(() => Promise.resolve());

    const testApp = createMembersTestPlugin({
      authService: {
        verifyOwnerOrAdmin: mock(() => {
          if (forbidden) {
            return Promise.resolve({
              uid: "someone-else",
              email: authEmail,
            } as DecodedIdToken);
          }

          return Promise.resolve({
            uid: memberId,
            email: authEmail,
          } as DecodedIdToken);
        }),
      },
      memberFirestoreService: {
        getMemberByUid,
        updateMember,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/sync-email`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    return { testApp, request, getMemberByUid, updateMember };
  }

  it("should sync the member email for the owner", async () => {
    const { testApp, request, updateMember } = setup();

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(updateMember).toHaveBeenCalledWith(
      "test-member-id",
      expect.objectContaining({
        email: "new@example.com",
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
  });

  it("should return success without updating when email is unchanged", async () => {
    const { testApp, request, updateMember } = setup({
      authEmail: "same@example.com",
      firestoreEmail: "same@example.com",
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("should return 403 when token owner does not match the member", async () => {
    const { testApp, request } = setup({ forbidden: true });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You can only sync your own email",
    });
  });

  it("should return 404 when member document does not exist", async () => {
    const { testApp, request } = setup({ memberExists: false });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Member not found" });
  });
});
