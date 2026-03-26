import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import {
  NotFoundError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import type { SetProfileEditingPermissionResult } from "../services/approve-profile.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

describe("POST /:memberId/profile/approve", () => {
  interface SetupOptions {
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;
    memberNotFound?: boolean;
    serverError?: boolean;
    isAdminLookupFails?: boolean;
  }

  function setup({
    body = { allowProfileEditing: true },
    memberId = "test-member-id",
    authToken = "admin-token",
    memberNotFound = false,
    serverError = false,
    isAdminLookupFails = false,
  }: SetupOptions = {}) {
    const mockApproveProfile = mock(
      ({
        memberId: approvedMemberId,
        allowProfileEditing,
      }: {
        memberId: string;
        allowProfileEditing: boolean;
      }): Promise<SetProfileEditingPermissionResult> => {
        if (memberNotFound) {
          return Promise.reject(
            new NotFoundError(`Member with ID ${memberId} not found`),
          );
        }
        if (serverError) {
          return Promise.reject(new Error("Firestore unavailable"));
        }
        const member: MemberDocument = {
          uid: approvedMemberId,
          email: "member@example.com",
          createdAt: Timestamp.now(),
          membershipActive: true,
          allowProfileEditing,
        };
        return Promise.resolve({ member });
      },
    );

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        approveProfile: mockApproveProfile,
        isAdmin: mock((): Promise<boolean> => {
          if (isAdminLookupFails) {
            return Promise.reject(new ValidationError("Lookup failed"));
          }
          return Promise.resolve(false);
        }),
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/profile/approve`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to approve profile work", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Input validation", () => {
    it("should return 422 when allowProfileEditing is missing", async () => {
      const { testApp, request } = setup({ body: {} });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 422 when allowProfileEditing is not a boolean", async () => {
      const { testApp, request } = setup({
        body: { allowProfileEditing: "yes" },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Success", () => {
    it("should return success with updated member data", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: {
          uid?: string;
          email?: string;
          allowProfileEditing?: boolean;
          isAdmin?: boolean;
        };
      };
      expect(body.success).toBe(true);
      expect(body.member?.uid).toBe("test-member-id");
      expect(body.member?.email).toBe("member@example.com");
      expect(body.member?.allowProfileEditing).toBe(true);
      expect(body.member?.isAdmin).toBe(false);
    });

    it("should return success when profile editing is disabled", async () => {
      const { testApp, request } = setup({
        body: { allowProfileEditing: false },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: {
          allowProfileEditing?: boolean;
        };
      };
      expect(body.success).toBe(true);
      expect(body.member?.allowProfileEditing).toBe(false);
    });

    it("should still return success when isAdmin lookup fails after approval", async () => {
      const { testApp, request } = setup({ isAdminLookupFails: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: {
          allowProfileEditing?: boolean;
          isAdmin?: boolean;
        };
      };
      expect(body.success).toBe(true);
      expect(body.member?.allowProfileEditing).toBe(true);
      expect(body.member?.isAdmin).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should return 404 when member not found", async () => {
      const { testApp, request } = setup({ memberNotFound: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("not found");
    });

    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain("Firestore unavailable");
    });
  });
});
