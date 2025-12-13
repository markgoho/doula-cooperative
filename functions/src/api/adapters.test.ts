import { describe, expect, it } from "bun:test";
import { toWebRequest, sendWebResponse } from "./adapters.js";
import type { Request as FirebaseRequest } from "firebase-functions/v2/https";
import type { Response as ExpressResponse } from "express";

/**
 * Tests for the adapter functions that bridge Firebase Functions and Elysia.
 *
 * Run these tests with:
 *   bun test test/api/adapters.test.ts
 */

// Mock Express Response for testing
type MockExpressResponse = Pick<ExpressResponse, "status" | "setHeader" | "send">;

describe("Adapters", () => {
  describe("toWebRequest", () => {
    it("should convert Firebase Request to Web Request", () => {
      const firebaseRequest = {
        method: "GET",
        url: "/test",
        headers: {
          host: "example.com",
          "user-agent": "test-agent",
        },
      } as unknown as FirebaseRequest;

      const webRequest = toWebRequest(firebaseRequest);

      expect(webRequest).toBeInstanceOf(Request);
      expect(webRequest.method).toBe("GET");
      expect(webRequest.url).toBe("https://example.com/test");
    });

    it("should default to localhost when host header is missing", () => {
      const firebaseRequest = {
        method: "GET",
        url: "/test",
        headers: {},
      } as unknown as FirebaseRequest;

      const webRequest = toWebRequest(firebaseRequest);

      expect(webRequest.url).toBe("https://localhost/test");
    });

    it("should exclude body for GET requests", () => {
      const firebaseRequest = {
        method: "GET",
        url: "/test",
        headers: { host: "example.com" },
        rawBody: Buffer.from("should not be included"),
      } as unknown as FirebaseRequest & { rawBody?: Buffer };

      const webRequest = toWebRequest(firebaseRequest);

      // GET requests should have null body
      expect(webRequest.body).toBeNull();
    });

    it("should exclude body for HEAD requests", () => {
      const firebaseRequest = {
        method: "HEAD",
        url: "/test",
        headers: { host: "example.com" },
        rawBody: Buffer.from("should not be included"),
      } as unknown as FirebaseRequest & { rawBody?: Buffer };

      const webRequest = toWebRequest(firebaseRequest);

      expect(webRequest.body).toBeNull();
    });

    it("should include body for POST requests", () => {
      const bodyContent = Buffer.from("test body");
      const firebaseRequest = {
        method: "POST",
        url: "/test",
        headers: { host: "example.com" },
        rawBody: bodyContent,
      } as unknown as FirebaseRequest & { rawBody?: Buffer };

      const webRequest = toWebRequest(firebaseRequest);

      expect(webRequest.body).not.toBeNull();
    });

    it("should handle URLs with query parameters", () => {
      const firebaseRequest = {
        method: "GET",
        url: "/test?foo=bar&baz=qux",
        headers: { host: "example.com" },
      } as unknown as FirebaseRequest;

      const webRequest = toWebRequest(firebaseRequest);

      expect(webRequest.url).toBe("https://example.com/test?foo=bar&baz=qux");
    });
  });

  describe("sendWebResponse", () => {
    it("should transfer status code to Express response", async () => {
      const webResponse = new Response("test body", { status: 201 });

      const mockResponse: MockExpressResponse = {
        status: (code: number) => {
          expect(code).toBe(201);
          return mockResponse as ExpressResponse;
        },
        setHeader: () => mockResponse as ExpressResponse,
        send: () => mockResponse as ExpressResponse,
      };

      await sendWebResponse(
        webResponse,
        mockResponse as ExpressResponse,
      );
    });

    it("should transfer headers to Express response", async () => {
      const webResponse = new Response("test", {
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "custom-value",
        },
      });

      const setHeaders: Record<string, string> = {};
      const mockResponse: MockExpressResponse = {
        status: () => mockResponse as ExpressResponse,
        setHeader: (key: string, value: string) => {
          setHeaders[key] = value;
          return mockResponse as ExpressResponse;
        },
        send: () => mockResponse as ExpressResponse,
      };

      await sendWebResponse(
        webResponse,
        mockResponse as ExpressResponse,
      );

      expect(setHeaders["content-type"]).toBe("application/json");
      expect(setHeaders["x-custom-header"]).toBe("custom-value");
    });

    it("should transfer body to Express response", async () => {
      const bodyContent = "test response body";
      const webResponse = new Response(bodyContent);

      let sentBody: string | undefined;
      const mockResponse: MockExpressResponse = {
        status: () => mockResponse as ExpressResponse,
        setHeader: () => mockResponse as ExpressResponse,
        send: (body: string) => {
          sentBody = body;
          return mockResponse as ExpressResponse;
        },
      };

      await sendWebResponse(
        webResponse,
        mockResponse as ExpressResponse,
      );

      expect(sentBody).toBe(bodyContent);
    });

    it("should handle JSON responses", async () => {
      const jsonData = { message: "hello", value: 123 };
      const webResponse = Response.json(jsonData, {
        headers: { "Content-Type": "application/json" },
      });

      let sentBody: string | undefined;
      const mockResponse: MockExpressResponse = {
        status: () => mockResponse as ExpressResponse,
        setHeader: () => mockResponse as ExpressResponse,
        send: (body: string) => {
          sentBody = body;
          return mockResponse as ExpressResponse;
        },
      };

      await sendWebResponse(
        webResponse,
        mockResponse as ExpressResponse,
      );

      expect(sentBody).toBe(JSON.stringify(jsonData));
    });
  });

  describe("Edge cases", () => {
    describe("toWebRequest edge cases", () => {
      it("should handle headers with array values", () => {
        const firebaseRequest = {
          method: "GET",
          url: "/test",
          headers: {
            host: "example.com",
            "set-cookie": ["cookie1=value1", "cookie2=value2"],
          },
        } as unknown as FirebaseRequest;

        const webRequest = toWebRequest(firebaseRequest);

        // Should not throw and should create a valid request
        expect(webRequest).toBeInstanceOf(Request);
        expect(webRequest.url).toBe("https://example.com/test");
      });

      it("should skip non-string, non-array header values", () => {
        const firebaseRequest = {
          method: "GET",
          url: "/test",
          headers: {
            host: "example.com",
            "valid-header": "valid-value",
            "invalid-header": undefined, // Non-string, non-array
          },
        } as unknown as FirebaseRequest;

        const webRequest = toWebRequest(firebaseRequest);

        // Should not throw and should create a valid request
        expect(webRequest).toBeInstanceOf(Request);
        expect(webRequest.headers.get("valid-header")).toBe("valid-value");
        expect(webRequest.headers.get("invalid-header")).toBeNull();
      });

      it("should throw error for invalid URL", () => {
        const firebaseRequest = {
          method: "GET",
          url: "not-a-valid-url-path",
          headers: {
            host: "not a valid host!!", // Invalid host
          },
        } as unknown as FirebaseRequest;

        expect(() => toWebRequest(firebaseRequest)).toThrow(
          "Failed to convert Firebase request to Web request",
        );
      });
    });

    describe("sendWebResponse edge cases", () => {
      it("should handle binary content types", async () => {
        // Create a mock binary response (image)
        const binaryData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
        const webResponse = new Response(binaryData.buffer, {
          headers: { "Content-Type": "image/jpeg" },
        });

        let sentBody: Buffer | undefined;
        const mockResponse: MockExpressResponse = {
          status: () => mockResponse as ExpressResponse,
          setHeader: () => mockResponse as ExpressResponse,
          send: (body: Buffer) => {
            sentBody = body;
            return mockResponse as ExpressResponse;
          },
        };

        await sendWebResponse(
          webResponse,
          mockResponse as ExpressResponse,
        );

        // Should send as Buffer for binary content
        expect(sentBody).toBeInstanceOf(Buffer);
        expect(sentBody?.length).toBe(4);
      });

      it("should handle XML content as text", async () => {
        const xmlContent = '<?xml version="1.0"?><root><item>test</item></root>';
        const webResponse = new Response(xmlContent, {
          headers: { "Content-Type": "application/xml" },
        });

        let sentBody: string | undefined;
        const mockResponse: MockExpressResponse = {
          status: () => mockResponse as ExpressResponse,
          setHeader: () => mockResponse as ExpressResponse,
          send: (body: string) => {
            sentBody = body;
            return mockResponse as ExpressResponse;
          },
        };

        await sendWebResponse(
          webResponse,
          mockResponse as ExpressResponse,
        );

        // Should send as text for XML
        expect(sentBody).toBe(xmlContent);
      });

      it("should handle responses with no body", async () => {
        const webResponse = new Response(undefined, {
          status: 204, // No Content
          headers: { "Content-Type": "application/json" },
        });

        let sentBody: string | undefined;
        const mockResponse: MockExpressResponse = {
          status: () => mockResponse as ExpressResponse,
          setHeader: () => mockResponse as ExpressResponse,
          send: (body: string) => {
            sentBody = body;
            return mockResponse as ExpressResponse;
          },
        };

        await sendWebResponse(
          webResponse,
          mockResponse as ExpressResponse,
        );

        // Should handle null body gracefully
        expect(sentBody).toBeDefined();
      });
    });
  });
});
