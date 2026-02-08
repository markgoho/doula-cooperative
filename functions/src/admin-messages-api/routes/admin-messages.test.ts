import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MessageDocument } from "../../collections/messages.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  toMessageResponse,
  type MessageResponse,
} from "../schemas/message-schemas.js";
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

  const mockMessage = toMessageResponse(
    mockMessageDocument.id,
    mockMessageDocument,
  );

  describe("GET / (list messages)", () => {
    interface SetupOptions {
      authToken?: string | null;
    }

    function setup({ authToken = "admin-token" }: SetupOptions = {}) {
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

      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const request = new Request("http://localhost/", { headers });

      return { testApp, request };
    }

    it("should return 401 when not authenticated", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return 403 when non-admin tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
    });

    it("should return messages list when authenticated as admin", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

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
    interface SetupOptions {
      messageId?: string;
      authToken?: string | null;
      messageNotFound?: boolean;
    }

    function setup({
      messageId = "message-1",
      authToken = "admin-token",
      messageNotFound = false,
    }: SetupOptions = {}) {
      const mockGetMessage = mock(() => {
        if (messageNotFound) {
          throw new NotFoundError("Message not found");
        }
        return Promise.resolve(mockMessage);
      });

      const testApp = createAdminTestPlugin({
        messageAdminService: { getMessage: mockGetMessage },
      });

      const headers: Record<string, string> = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const request = new Request(`http://localhost/${messageId}`, {
        headers,
      });

      return { testApp, request };
    }

    it("should return 401 when not authenticated", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should return message when authenticated", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as MessageResponse;
      expect(body.id).toBe("message-1");
      expect(body.contactName).toBe("Jane Doe");
    });

    it("should return 404 when message not found", async () => {
      const { testApp, request } = setup({
        messageId: "nonexistent",
        messageNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /:messageId (update message)", () => {
    interface SetupOptions {
      body?: Record<string, unknown>;
      messageId?: string;
      authToken?: string | null;
      messageNotFound?: boolean;
    }

    function setup({
      body = { sent: true },
      messageId = "message-1",
      authToken = "admin-token",
      messageNotFound = false,
    }: SetupOptions = {}) {
      const mockUpdateMessage = mock(() => {
        if (messageNotFound) {
          throw new NotFoundError("Message not found");
        }
        return Promise.resolve({ success: true as const });
      });

      const testApp = createAdminTestPlugin({
        messageAdminService: { updateMessage: mockUpdateMessage },
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const request = new Request(`http://localhost/${messageId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });

      return { testApp, request };
    }

    it("should return 401 when not authenticated", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should update message when authenticated", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("should return 422 when body is invalid", async () => {
      const { testApp, request } = setup({ body: {} });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 404 when message not found", async () => {
      const { testApp, request } = setup({
        messageId: "nonexistent",
        messageNotFound: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(404);
    });
  });
});
