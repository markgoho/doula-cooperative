import { ConflictError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { handleRequest } from "@doula-coop/functions-shared/test-utils/handle-request.js";
import { describe, expect, it, mock } from "bun:test";
import { createProfilesTestPlugin } from "../test-utils/create-profiles-test-plugin.js";

/**
 * Tests for POST /slugs (set profile slug).
 * Served at /api/profiles/slugs via Firebase rewrite.
 *
 * Uses createProfilesTestPlugin() factory with mocked services.
 */
describe("POST /slugs (set profile slug)", () => {
  interface SetupOptions {
    body?: { slug: string };
    authToken?: string | null;
    slugTaken?: boolean;
    serverError?: boolean;
  }

  function setup({
    body = { slug: "test-slug" },
    authToken = "valid-token",
    slugTaken = false,
    serverError = false,
  }: SetupOptions = {}) {
    const mockSetSlug = mock(() => {
      if (slugTaken) {
        return Promise.reject(
          new ConflictError(
            "This slug is already taken. Please choose another.",
          ),
        );
      }
      if (serverError) {
        return Promise.reject(new Error("Database write failed"));
      }
      return Promise.resolve({ slug: body.slug });
    });

    const testApp = createProfilesTestPlugin({
      profileMemberService: {
        setSlug: mockSetSlug,
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/slugs", {
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

    it("should return 401 when token is invalid", async () => {
      const { testApp, request } = setup({ authToken: "invalid-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(401);
    });

    it("should allow authenticated user to set slug", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("should return 422 when slug is too short", async () => {
      const { testApp, request } = setup({ body: { slug: "a" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 422 when slug has uppercase letters", async () => {
      const { testApp, request } = setup({ body: { slug: "Test-Slug" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should return 422 when slug has special characters", async () => {
      const { testApp, request } = setup({ body: { slug: "test_slug" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(422);
    });

    it("should accept valid slug with lowercase and hyphens", async () => {
      const { testApp, request } = setup({ body: { slug: "jane-doe-doula" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
    });
  });

  describe("Slug setting", () => {
    it("should return success when slug is set", async () => {
      const { testApp, request } = setup({ body: { slug: "new-slug" } });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as { slug?: string };
      expect(body.slug).toBe("new-slug");
    });

    it("should return 409 when slug is already taken", async () => {
      const { testApp, request } = setup({
        body: { slug: "taken-slug" },
        slugTaken: true,
      });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toContain("already taken");
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      // Should NOT expose internal error details
      expect(body.error).not.toContain("Database");
    });
  });
});
