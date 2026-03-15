import { describe, expect, it, mock } from "bun:test";
import { handleRequest } from "../../test-utils/handle-request.js";
import type { UnlinkedProfile } from "../services/list-unlinked-profiles.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET /unlinked-profiles.
 * Served at /api/admin/members/unlinked-profiles via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("GET /unlinked-profiles", () => {
  interface SetupOptions {
    authToken?: string | null;
    serverError?: boolean;
    profiles?: UnlinkedProfile[];
  }

  function setup({
    authToken = "admin-token",
    serverError = false,
    profiles,
  }: SetupOptions = {}) {
    const defaultProfiles: UnlinkedProfile[] = [
      {
        slug: "unlinked-doula-one",
        title: "Doula One",
        email: "doula-one@example.com",
        createdAt: "2024-03-15T10:00:00.000Z",
      },
      {
        slug: "unlinked-doula-two",
        title: "Doula Two",
        email: "doula-two@example.com",
        createdAt: "2024-05-20T14:30:00.000Z",
      },
    ];

    const mockListUnlinkedProfiles = mock(() => {
      if (serverError) {
        return Promise.reject(new Error("Firestore unavailable"));
      }
      return Promise.resolve({
        profiles: profiles ?? defaultProfiles,
      });
    });

    const testApp = createAdminTestPlugin({
      memberAdminService: {
        listUnlinkedProfiles: mockListUnlinkedProfiles,
      },
    });

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/unlinked-profiles", {
      headers,
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

    it("should return 403 when non-admin user tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });
  });

  describe("Successful response", () => {
    it("should return profiles array", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        profiles?: {
          slug?: string;
          title?: string;
          email?: string;
          createdAt?: string;
        }[];
      };
      expect(Array.isArray(body.profiles)).toBe(true);
      expect(body.profiles?.length).toBe(2);
    });

    it("should include slug, title, email, and createdAt for each profile", async () => {
      const { testApp, request } = setup();

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        profiles?: {
          slug?: string;
          title?: string;
          email?: string;
          createdAt?: string;
        }[];
      };
      const firstProfile = body.profiles?.[0];
      expect(firstProfile?.slug).toBe("unlinked-doula-one");
      expect(firstProfile?.title).toBe("Doula One");
      expect(firstProfile?.email).toBe("doula-one@example.com");
      expect(firstProfile?.createdAt).toBe("2024-03-15T10:00:00.000Z");
    });

    it("should return empty array when no unlinked profiles exist", async () => {
      const { testApp, request } = setup({ profiles: [] });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        profiles?: unknown[];
      };
      expect(Array.isArray(body.profiles)).toBe(true);
      expect(body.profiles?.length).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("should return 500 when service throws unexpected error", async () => {
      const { testApp, request } = setup({ serverError: true });

      const response = await handleRequest(testApp, request);

      expect(response.status).toBe(500);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain("Firestore unavailable");
      expect(body.error).toContain("list unlinked profiles");
    });
  });
});
