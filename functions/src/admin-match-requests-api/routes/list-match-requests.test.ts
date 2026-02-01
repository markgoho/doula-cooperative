import { describe, expect, it, mock } from "bun:test";
import { Timestamp } from "firebase-admin/firestore";
import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { toMatchRequestResponse } from "../schemas/match-request-schemas.js";
import { createAdminTestPlugin } from "../test-utils/create-admin-test-plugin.js";

/**
 * Tests for GET / (list match requests with pagination).
 * Served at /api/admin/match-requests/ via Firebase rewrite.
 *
 * Uses createAdminTestPlugin() factory with mocked services.
 */
describe("GET / (list match requests)", () => {
  interface SetupOptions {
    // Request parameters
    authToken?: string | null;
  }

  function setup({ authToken = "admin-token" }: SetupOptions = {}) {
    const mockMatchRequestDocuments: (MatchRequestDocument & {
      id: string;
    })[] = [
      {
        id: "request-1",
        name: "Jane Doe",
        phone: "555-1234",
        email: "jane@example.com",
        zipcode: "12345",
        estimatedDueDate: { month: "03", day: "15", year: "2025" },
        services: ["birth-doula"],
        birthLocation: "Hospital",
        otherInfo: "First time parent",
        insurance: ["Blue Cross"],
        submitted: Timestamp.now(),
        sent: false,
        recaptchaScore: 0.9,
      },
      {
        id: "request-2",
        name: "John Smith",
        phone: "555-5678",
        email: "john@example.com",
        zipcode: "54321",
        estimatedDueDate: { month: "04", day: "20", year: "2025" },
        services: ["postpartum-doula"],
        birthLocation: "Home",
        otherInfo: "",
        insurance: ["Aetna"],
        submitted: Timestamp.now(),
        sent: true,
      },
    ];

    const mockListMatchRequests = mock(() => {
      return Promise.resolve({
        requests: mockMatchRequestDocuments.map(document =>
          toMatchRequestResponse(document.id, document),
        ),
        total: 2,
        pendingCount: 1,
        processedCount: 1,
      });
    });

    const testApp = createAdminTestPlugin({
      matchRequestAdminService: {
        listMatchRequests: mockListMatchRequests,
      },
    });

    // Build request from parameters
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const request = new Request("http://localhost/", {
      headers,
    });

    return { testApp, request };
  }

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const { testApp, request } = setup({ authToken: null });

      const response = await testApp.handle(request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Missing Authorization header");
    });

    it("should return 403 when non-admin user tries to access", async () => {
      const { testApp, request } = setup({ authToken: "non-admin-token" });

      const response = await testApp.handle(request);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Admin privileges required");
    });

    it("should allow admin to list match requests", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Response Format", () => {
    it("should return match requests with proper structure", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        requests: unknown[];
        total: number;
        pendingCount: number;
        processedCount: number;
      };

      expect(body).toHaveProperty("requests");
      expect(body).toHaveProperty("total");
      expect(body).toHaveProperty("pendingCount");
      expect(body).toHaveProperty("processedCount");
      expect(Array.isArray(body.requests)).toBe(true);
    });

    it("should convert Firestore Timestamps to ISO strings", async () => {
      const { testApp, request } = setup();

      const response = await testApp.handle(request);

      const body = (await response.json()) as {
        requests: { submitted?: string }[];
      };
      const firstRequest = body.requests[0];

      // Verify submitted is an ISO string, not a Timestamp object
      expect(typeof firstRequest?.submitted).toBe("string");
      expect(firstRequest?.submitted).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });
  });
});
