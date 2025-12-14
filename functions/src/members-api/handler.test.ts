import { describe, expect, it, mock } from "bun:test";
import { handleMembersApi } from "./handler.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

/**
 * Tests for the members-api handler (entry point).
 *
 * Tests the integration between Firebase Functions and Elysia,
 * including error handling for adapter failures and unexpected errors.
 *
 * Run these tests with:
 *   bun test src/members-api/handler.test.ts
 */
describe("handleMembersApi", () => {
  describe("Error handling", () => {
    it("should handle errors and log them", async () => {
      const errorMock = mock();

      const mockLogger: Logger = {
        error: errorMock,
        warn: mock(),
        info: mock(),
      };

      const statusMock = mock(() => mockResponse);
      const jsonMock = mock();

      const mockResponse = {
        headersSent: false,
        status: statusMock,
        json: jsonMock,
      } as unknown as Response;

      // Force an error by creating an invalid request that will fail adapter conversion
      const badRequest = {
        url: "not-a-valid-url",
        method: "GET",
        headers: { host: undefined },
      } as unknown as Request;

      await handleMembersApi(badRequest, mockResponse, mockLogger);

      // Verify error was logged
      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(Array.isArray(errorMock.mock.calls[0])).toBe(true);
      expect(errorMock.mock.calls[0]?.[0]).toBe("Elysia members-api handler failed");

      // Verify error context includes expected fields
      const context = errorMock.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
      expect(context).toBeDefined();
      expect(typeof context?.["errorMessage"]).toBe("string");
      expect(context?.["path"]).toBe("not-a-valid-url");
      expect(context?.["method"]).toBe("GET");

      // Verify error response was sent
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledTimes(1);
    });

    it("should handle successful requests without errors", async () => {
      const errorMock = mock();

      const mockLogger: Logger = {
        error: errorMock,
        warn: mock(),
        info: mock(),
      };

      const mockRequest = {
        url: "/health",
        method: "GET",
        headers: { host: "localhost" },
      } as unknown as Request;

      const statusMock = mock(() => mockResponse);
      const sendMock = mock();
      const setHeaderMock = mock();

      const mockResponse = {
        headersSent: false,
        status: statusMock,
        send: sendMock,
        setHeader: setHeaderMock,
      } as unknown as Response;

      await handleMembersApi(mockRequest, mockResponse, mockLogger);

      // No errors should be logged for successful requests
      expect(errorMock).not.toHaveBeenCalled();
    });

    it("should include error stack in logs when available", async () => {
      const errorMock = mock();

      const mockLogger: Logger = {
        error: errorMock,
        warn: mock(),
        info: mock(),
      };

      const badRequest = {
        url: "not-a-valid-url",
        method: "GET",
        headers: { host: undefined },
      } as unknown as Request;

      const statusMock = mock(() => mockResponse);
      const jsonMock = mock();

      const mockResponse = {
        headersSent: false,
        status: statusMock,
        json: jsonMock,
      } as unknown as Response;

      await handleMembersApi(badRequest, mockResponse, mockLogger);

      // Verify error stack is included when error is an Error instance
      const logCall = errorMock.mock.calls[0];
      expect(Array.isArray(logCall)).toBe(true);
      const context = logCall?.[1] as Record<string, unknown> | undefined;
      expect(context).toHaveProperty("errorStack");
      expect(typeof context?.["errorStack"]).toBe("string");
    });
  });
});
