import { describe, expect, it, beforeEach, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import { NotFoundError, ValidationError } from "../../shared-api/errors/http-error.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for PATCH /admin/members/:memberId.
 *
 * Uses createApp() factory with mocked services.
 * Tests run WITHOUT Firebase emulators.
 */
describe("PATCH /admin/members/:memberId", () => {
  const mockUpdateMember = mock(
    (
      memberId: string,
      updates: Record<string, unknown>,
    ): Promise<MemberDocument> => {
      if (memberId === "test-member-id") {
        return Promise.resolve({
          uid: "test-member-id",
          email:
            typeof updates["email"] === "string"
              ? updates["email"]
              : "test@example.com",
          createdAt: Timestamp.now(),
          name:
            typeof updates["name"] === "string"
              ? updates["name"]
              : "Updated Member",
          membershipActive: true,
        });
      }
      if (memberId === "non-existent-id") {
        return Promise.reject(new NotFoundError("Member not found"));
      }
      if (updates["uid"]) {
        return Promise.reject(
          new ValidationError("Cannot update protected field: uid"),
        );
      }
      return Promise.resolve({} as MemberDocument);
    },
  );

  const testApp = createAdminTestPlugin({
    memberAdminService: {
      updateMember: mockUpdateMember,
    },
  });

  beforeEach(() => {
    mockUpdateMember.mockClear();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-id", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Name" }),
        }),
      )) as Response;

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to update", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer non-admin-token",
          },
          body: JSON.stringify({ name: "New Name" }),
        }),
      )) as Response;

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Input validation", () => {
    it("should reject updates with invalid email format", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({ email: "not-an-email" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject empty name strings", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({ name: "" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should reject invalid date-time format", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({ subscriptionStart: "not-a-date" }),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });
  });

  describe("Successful updates", () => {
    it("should update member and return updated document", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-member-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({ name: "Updated Name" }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        member?: { uid?: string; name?: string };
      };
      expect(body.success).toBe(true);
      expect(body.member?.uid).toBe("test-member-id");
      expect(body.member?.name).toBe("Updated Name");
    });

    it("should call updateMember service with correct parameters", async () => {
      await testApp.handle(
        new Request("http://localhost/admin/members/test-member-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({
            name: "New Name",
            email: "new@example.com",
          }),
        }),
      );

      expect(mockUpdateMember).toHaveBeenCalledTimes(1);
      expect(mockUpdateMember.mock.calls[0]?.[0]).toBe("test-member-id");
      const updates = mockUpdateMember.mock.calls[0]?.[1];
      expect(updates).toBeDefined();
      if (updates) {
        expect(updates["name"]).toBe("New Name");
        expect(updates["email"]).toBe("new@example.com");
      }
    });
  });

  describe("Error handling", () => {
    it("should return 404 when member not found", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/non-existent-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({ name: "New Name" }),
        }),
      )) as Response;

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Member not found");
    });
  });

  describe("Protected fields", () => {
    it("should strip unknown fields (like uid) at schema level", async () => {
      mockUpdateMember.mockClear();

      await testApp.handle(
        new Request("http://localhost/admin/members/test-member-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({ uid: "different-uid", name: "Valid Name" }),
        }),
      );

      // Elysia schema strips unknown fields before passing to service
      expect(mockUpdateMember).toHaveBeenCalledTimes(1);
      const updates = mockUpdateMember.mock.calls[0]?.[1];
      expect(updates).toBeDefined();
      if (updates) {
        expect(updates["uid"]).toBeUndefined();
        expect(updates["name"]).toBe("Valid Name");
      }
    });
  });

  describe("Response format", () => {
    it("should convert Timestamp fields to ISO strings", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/admin/members/test-member-id", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer admin-token",
          },
          body: JSON.stringify({ name: "New Name" }),
        }),
      )) as Response;

      const body = (await response.json()) as {
        member?: { createdAt?: string };
      };
      expect(body.member?.createdAt).toBeDefined();
      expect(typeof body.member?.createdAt).toBe("string");
    });
  });
});
