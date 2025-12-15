import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MessageDocument } from "../../collections/messages.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { toMessageResponse, type MessageResponse } from "../schemas/message-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Comprehensive tests for admin messages API routes.
 * Tests all three routes (list, get, update) in one file.
 */
describe("Admin Messages API", () => {
  const mockMessageDocument: MessageDocument & { id: string } = {
    id: "message-1",
    contactName: "Jane Doe",
    email: "jane@example.com",
    message: "Test message",
    submitted: Timestamp.now(),
    sent: false,
    recaptchaScore: 0.9,
  };

  const mockMessage = toMessageResponse(mockMessageDocument.id, mockMessageDocument);

  describe("GET / (list messages)", () => {
    const mockListMessages = mock(() =>
      Promise.resolve({
        messages: [mockMessage],
        total: 1,
        pendingCount: 1,
        processedCount: 0,
      }),
    );

    const testApp = createAdminTestPlugin({
      messageAdminService: { listMessages: mockListMessages },
    });

    beforeEach(() => {
      mockListMessages.mockClear();
    });

    it("should return 401 when not authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/"),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to access", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer non-admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(403);
    });

    it("should return messages list when authenticated as admin", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        messages: unknown[];
        total: number;
        pendingCount: number;
        processedCount: number;
      };
      expect(body.messages).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.pendingCount).toBe(1);
      expect(body.processedCount).toBe(0);
    });
  });

  describe("GET /:messageId (get message)", () => {
    const mockGetMessage = mock(() => Promise.resolve(mockMessage));
    const testApp = createAdminTestPlugin({
      messageAdminService: { getMessage: mockGetMessage },
    });

    beforeEach(() => {
      mockGetMessage.mockClear();
    });

    it("should return 401 when not authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/message-1"),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should return message when authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/message-1", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as MessageResponse;
      expect(body.id).toBe("message-1");
      expect(body.contactName).toBe("Jane Doe");
    });

    it("should return 404 when message not found", async () => {
      const notFoundApp = createAdminTestPlugin({
        messageAdminService: {
          getMessage: mock(() => {
            throw new NotFoundError("Message not found");
          }),
        },
      });

      const response = (await notFoundApp.handle(
        new Request("http://localhost/nonexistent", {
          headers: { Authorization: "Bearer admin-token" },
        }),
      )) as Response;

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /:messageId (update message)", () => {
    const mockUpdateMessage = mock(() =>
      Promise.resolve({ success: true as const }),
    );
    const testApp = createAdminTestPlugin({
      messageAdminService: { updateMessage: mockUpdateMessage },
    });

    beforeEach(() => {
      mockUpdateMessage.mockClear();
    });

    it("should return 401 when not authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/message-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sent: true }),
        }),
      )) as Response;

      expect(response.status).toBe(401);
    });

    it("should update message when authenticated", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/message-1", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sent: true }),
        }),
      )) as Response;

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("should return 422 when body is invalid", async () => {
      const response = (await testApp.handle(
        new Request("http://localhost/message-1", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      )) as Response;

      expect(response.status).toBe(422);
    });

    it("should return 404 when message not found", async () => {
      const notFoundApp = createAdminTestPlugin({
        messageAdminService: {
          updateMessage: mock(() => {
            throw new NotFoundError("Message not found");
          }),
        },
      });

      const response = (await notFoundApp.handle(
        new Request("http://localhost/nonexistent", {
          method: "PATCH",
          headers: {
            Authorization: "Bearer admin-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sent: true }),
        }),
      )) as Response;

      expect(response.status).toBe(404);
    });
  });
});
