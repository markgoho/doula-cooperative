import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { AuthError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

describe("POST /:memberId/sync-email (authenticated)", () => {
  interface SetupOptions {
    memberId?: string;
    authToken?: string | null;
    authEmail?: string;
    firestoreEmail?: string | number | null;
    memberExists?: boolean;
    forbidden?: boolean;
    tokenHasNoEmail?: boolean;
    unauthorized?: boolean;
    firestoreReadError?: Error | null;
    firestoreUpdateError?: Error | null;
    sendEmailError?: Error | null;
  }

  function setup({
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    authEmail = "new@example.com",
    firestoreEmail = "old@example.com",
    memberExists = true,
    forbidden = false,
    tokenHasNoEmail = false,
    unauthorized = false,
    firestoreReadError = null,
    firestoreUpdateError = null,
    sendEmailError = null,
  }: SetupOptions = {}) {
    const getMemberByUid = mock(() =>
      firestoreReadError
        ? Promise.reject(firestoreReadError)
        : Promise.resolve({
            exists: memberExists,
            data: () => ({ email: firestoreEmail }),
          } as unknown as DocumentSnapshot),
    );
    const updateMember = mock(() =>
      firestoreUpdateError
        ? Promise.reject(firestoreUpdateError)
        : Promise.resolve(),
    );
    const sendEmail = mock(() =>
      sendEmailError ? Promise.reject(sendEmailError) : Promise.resolve(),
    );

    const testApp = createMembersTestPlugin({
      authService: {
        verifyOwnerOrAdmin: mock(() => {
          if (unauthorized) {
            return Promise.reject(
              new AuthError("Missing Authorization header"),
            );
          }
          if (forbidden) {
            return Promise.resolve({
              uid: "someone-else",
              email: authEmail,
            } as DecodedIdToken);
          }

          return Promise.resolve({
            uid: memberId,
            ...(tokenHasNoEmail ? {} : { email: authEmail }),
          } as DecodedIdToken);
        }),
      },
      memberFirestoreService: {
        getMemberByUid,
        updateMember,
      },
      emailService: {
        sendEmail,
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

    return { testApp, request, updateMember, sendEmail };
  }

  it("should sync the member email for the owner", async () => {
    const { testApp, request, updateMember } = setup();

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      synced: true,
      email: "new@example.com",
    });
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
    expect(await response.json()).toEqual({
      success: true,
      synced: false,
      email: "same@example.com",
    });
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("should return 401 when no auth header is provided", async () => {
    const { testApp, request } = setup({
      authToken: null,
      unauthorized: true,
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(401);
  });

  it("should return 403 when token owner does not match the member", async () => {
    const { testApp, request } = setup({ forbidden: true });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You can only sync your own email",
    });
  });

  it("should return 403 when the token has no email claim", async () => {
    const { testApp, request, updateMember } = setup({ tokenHasNoEmail: true });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Authenticated user does not have an email address",
    });
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("should return 404 when member document does not exist", async () => {
    const { testApp, request } = setup({ memberExists: false });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Member not found" });
  });

  it("should return 500 and notify admins when Firestore update fails after Auth change", async () => {
    const { testApp, request, sendEmail } = setup({
      firestoreUpdateError: new Error("Firestore unavailable"),
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Your sign-in email was updated, but we could not refresh your membership email. Our team has been notified.",
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("should still return 500 when both Firestore update and admin notification fail", async () => {
    const { testApp, request } = setup({
      firestoreUpdateError: new Error("Firestore unavailable"),
      sendEmailError: new Error("Mailgun down"),
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Your sign-in email was updated, but we could not refresh your membership email. Our team has been notified.",
    });
  });

  it("should return 500 and notify admins when Firestore read fails after Auth change", async () => {
    const { testApp, request, sendEmail } = setup({
      firestoreReadError: new Error("Firestore read unavailable"),
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Your sign-in email was updated, but we could not refresh your membership email. Our team has been notified.",
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("should update Firestore when stored email is a non-string value", async () => {
    const { testApp, request, updateMember } = setup({
      firestoreEmail: null,
    });

    const response = await handleRequest(testApp, request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      synced: true,
      email: "new@example.com",
    });
    expect(updateMember).toHaveBeenCalled();
  });
});
