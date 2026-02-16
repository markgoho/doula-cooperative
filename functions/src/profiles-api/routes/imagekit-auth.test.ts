import { describe, expect, it, mock } from "bun:test";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import { handleRequest } from "../../test-utils/handle-request.js";
import {
  createProfilesTestPlugin,
  mockMemberDocument,
} from "../test-utils/create-profiles-test-plugin.js";

describe("GET /auth (ImageKit auth)", () => {
  // Ensure env vars are set for tests
  process.env["IMAGEKIT_PRIVATE_KEY"] = "test-private-key";
  process.env["IMAGEKIT_PUBLIC_KEY"] = "test-public-key";

  interface SetupOptions {
    authToken?: string | null;
    inactiveMembership?: boolean;
  }

  function setup({
    authToken = "valid-token",
    inactiveMembership = false,
  }: SetupOptions = {}) {
    const mockVerifyMembership = mock(() => {
      if (inactiveMembership) {
        return Promise.reject(
          new ForbiddenError("User does not have an active membership."),
        );
      }
      return Promise.resolve(mockMemberDocument);
    });

    const testApp = createProfilesTestPlugin({
      profileMemberService: {
        verifyActiveMembership: mockVerifyMembership,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/auth", {
      method: "GET",
      headers,
    });

    return { testApp, request, mockVerifyMembership };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 401 when token is invalid", async () => {
      const { testApp, request } = setup({ authToken: "invalid-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid authentication token");
    });
  });

  describe("Membership verification", () => {
    it("should return 403 when user has inactive membership", async () => {
      const { testApp, request } = setup({ inactiveMembership: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
    });
  });

  describe("Success cases", () => {
    it("should return 200 with auth parameters for valid user", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        token: string;
        expire: number;
        signature: string;
      };
      expect(body.token).toBeDefined();
      expect(body.expire).toBeTypeOf("number");
      expect(body.signature).toBeDefined();
    });

    it("should verify active membership before returning auth params", async () => {
      const { testApp, request, mockVerifyMembership } = setup();

      await handleRequest(testApp, request);

      expect(mockVerifyMembership).toHaveBeenCalledTimes(1);
      expect(mockVerifyMembership).toHaveBeenCalledWith("test-user-123");
    });
  });

  describe("Environment configuration", () => {
    it("should return 500 when IMAGEKIT_PRIVATE_KEY is missing", async () => {
      const originalValue = process.env["IMAGEKIT_PRIVATE_KEY"];
      delete process.env["IMAGEKIT_PRIVATE_KEY"];

      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);

      if (originalValue !== undefined) {
        process.env["IMAGEKIT_PRIVATE_KEY"] = originalValue;
      }

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("ImageKit");
    });

    it("should return 500 when IMAGEKIT_PUBLIC_KEY is missing", async () => {
      const originalValue = process.env["IMAGEKIT_PUBLIC_KEY"];
      delete process.env["IMAGEKIT_PUBLIC_KEY"];

      const { testApp, request } = setup();
      const response = await handleRequest(testApp, request);

      if (originalValue !== undefined) {
        process.env["IMAGEKIT_PUBLIC_KEY"] = originalValue;
      }

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("ImageKit");
    });
  });
});
