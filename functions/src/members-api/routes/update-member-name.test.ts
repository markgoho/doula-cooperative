import { describe, expect, it, mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createMembersTestPlugin } from "../test-utils/create-members-test-plugin.js";

/**
 * Tests for the member name update endpoint.
 *
 * Uses createMembersTestPlugin() factory with mocked services.
 * Tests only the members plugin in isolation.
 */
describe("PATCH /:memberId/name (authenticated)", () => {
  interface SetupOptions {
    body?: Record<string, unknown>;
    memberId?: string;
    authToken?: string | null;
    memberNotFound?: boolean;
    serverError?: boolean;
  }

  function setup({
    body = { name: "Jane Doe" },
    memberId = "test-member-id",
    authToken = "valid-owner-token",
    memberNotFound = false,
    serverError = false,
  }: SetupOptions = {}) {
    const mockUpdateName = mock(
      (id: string, name: string): Promise<MemberDocument> => {
        if (serverError) {
          throw new Error("Firestore connection error");
        }
        if (memberNotFound || id === "non-existent-id") {
          return Promise.reject(new NotFoundError("Member not found"));
        }
        return Promise.resolve({
          uid: id,
          email: "test@example.com",
          name,
          createdAt: Timestamp.fromDate(new Date("2024-01-01")),
        } as MemberDocument);
      },
    );

    const mockVerifyOwnerOrAdmin = mock(
      (
        authorizationHeader: string | undefined,
        targetMemberId: string,
      ): Promise<DecodedIdToken> => {
        if (!authorizationHeader) {
          return Promise.reject(new AuthError("Missing Authorization header"));
        }

        if (
          authorizationHeader === "Bearer valid-owner-token" &&
          (targetMemberId === "test-member-id" || targetMemberId === "test-id")
        ) {
          return Promise.resolve({
            uid: targetMemberId,
            email: "test@example.com",
          } as DecodedIdToken);
        }

        if (authorizationHeader === "Bearer admin-token") {
          return Promise.resolve({
            uid: "admin-user",
            email: "admin@example.com",
            admin: true,
          } as unknown as DecodedIdToken);
        }

        if (authorizationHeader === "Bearer non-owner-token") {
          return Promise.reject(
            new ForbiddenError("You can only update your own name"),
          );
        }

        return Promise.reject(new AuthError("Invalid authentication token"));
      },
    );

    const testApp = createMembersTestPlugin({
      memberService: {
        updateName: mockUpdateName,
      },
      authService: {
        verifyOwnerOrAdmin: mockVerifyOwnerOrAdmin,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request(`http://localhost/${memberId}/name`, {
      method: "PATCH",
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

    it("should return 403 when non-owner tries to update name", async () => {
      const { testApp, request } = setup({ authToken: "non-owner-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("You can only update your own name");
    });

    it("should allow owner to update their own name", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        member: { name: string };
      };
      expect(body.success).toBe(true);
      expect(body.member.name).toBe("Jane Doe");
    });

    it("should allow admin to update any member name", async () => {
      const { testApp, request } = setup({
        authToken: "admin-token",
        body: { name: "Updated Name" },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        member: { name: string };
      };
      expect(body.success).toBe(true);
      expect(body.member.name).toBe("Updated Name");
    });
  });

  describe("Name update", () => {
    it("should return 404 when member does not exist", async () => {
      const { testApp, request } = setup({
        memberId: "non-existent-id",
        authToken: "admin-token",
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });

    it("should return updated member data on success", async () => {
      const { testApp, request } = setup({ body: { name: "New Name" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        member: { name: string; uid: string; email: string };
      };
      expect(body.success).toBe(true);
      expect(body.member.name).toBe("New Name");
      expect(body.member.uid).toBe("test-member-id");
    });
  });

  describe("Input validation", () => {
    it("should reject request without name field", async () => {
      const { testApp, request } = setup({ body: {} });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should reject request with empty name", async () => {
      const { testApp, request } = setup({ body: { name: "" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should reject request with non-string name", async () => {
      const { testApp, request } = setup({ body: { name: 123 } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should reject request with name exceeding 200 characters", async () => {
      const { testApp, request } = setup({
        body: { name: "a".repeat(201) },
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });
  });

  describe("Error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Failed to update member name");
    });
  });
});
