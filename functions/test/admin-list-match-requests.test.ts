import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { MATCH_REQUESTS_COLLECTION } from "../src/collections/match-requests.js";
import { adminListMatchRequests } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();
const wrapped = test.wrap(adminListMatchRequests);

function setup({
  limit = 50,
  offset = 0,
  status = "all" as "all" | "pending" | "processed",
  uid = "test-admin-uid",
} = {}) {
  const request = createMockCallableRequest({
    data: { limit, offset, status },
    uid,
    email: "admin@example.com",
    emailVerified: true,
    isAdmin: true,
  });

  return { request };
}

describe("adminListMatchRequests", () => {
  beforeEach(async () => {
    // Clean up any existing test data
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .where("email", ">=", "test-")
      .where("email", "<=", "test-\uF8FF")
      .get();

    const batch = firestore.batch();
    for (const document of snapshot.docs) {
      batch.delete(document.ref);
    }
    await batch.commit();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return empty list when no match requests exist", async () => {
    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.requests).toEqual([]);
  });

  it("should return list of match requests", async () => {
    const firestore = getFirestore();

    // Create test match request
    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Client",
      email: "test-client@example.com",
      phone: "555-1234",
      zipcode: "12345",
      estimatedDueDate: {
        month: "12",
        day: "25",
        year: "2025",
      },
      services: ["birth-doula"],
      submitted: new Date().toISOString(),
      sent: false,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.requests.length).toBe(1);
  });

  it("should return total count", async () => {
    const firestore = getFirestore();

    // Create test match requests
    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Client 1",
      email: "test-client1@example.com",
      phone: "555-1234",
      zipcode: "12345",
      estimatedDueDate: { month: "12", day: "25", year: "2025" },
      services: ["birth-doula"],
      submitted: new Date().toISOString(),
      sent: false,
    });

    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Client 2",
      email: "test-client2@example.com",
      phone: "555-5678",
      zipcode: "54321",
      estimatedDueDate: { month: "1", day: "15", year: "2026" },
      services: ["postpartum-doula"],
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.total).toBe(2);
  });

  it("should return pending count", async () => {
    const firestore = getFirestore();

    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Pending",
      email: "test-pending@example.com",
      phone: "555-1234",
      zipcode: "12345",
      estimatedDueDate: { month: "12", day: "25", year: "2025" },
      services: ["birth-doula"],
      submitted: new Date().toISOString(),
      sent: false,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.pendingCount).toBe(1);
  });

  it("should return processed count", async () => {
    const firestore = getFirestore();

    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Processed",
      email: "test-processed@example.com",
      phone: "555-1234",
      zipcode: "12345",
      estimatedDueDate: { month: "12", day: "25", year: "2025" },
      services: ["birth-doula"],
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.processedCount).toBe(1);
  });

  it("should filter by pending status", async () => {
    const firestore = getFirestore();

    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Pending",
      email: "test-pending2@example.com",
      phone: "555-1234",
      zipcode: "12345",
      estimatedDueDate: { month: "12", day: "25", year: "2025" },
      services: ["birth-doula"],
      submitted: new Date().toISOString(),
      sent: false,
    });

    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Processed",
      email: "test-processed2@example.com",
      phone: "555-5678",
      zipcode: "54321",
      estimatedDueDate: { month: "1", day: "15", year: "2026" },
      services: ["postpartum-doula"],
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup({ status: "pending" });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.requests.length).toBe(1);
  });

  it("should filter by processed status", async () => {
    const firestore = getFirestore();

    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Pending",
      email: "test-pending3@example.com",
      phone: "555-1234",
      zipcode: "12345",
      estimatedDueDate: { month: "12", day: "25", year: "2025" },
      services: ["birth-doula"],
      submitted: new Date().toISOString(),
      sent: false,
    });

    await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
      name: "Test Processed",
      email: "test-processed3@example.com",
      phone: "555-5678",
      zipcode: "54321",
      estimatedDueDate: { month: "1", day: "15", year: "2026" },
      services: ["postpartum-doula"],
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup({ status: "processed" });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.requests.length).toBe(1);
  });

  it("should respect limit parameter", async () => {
    const firestore = getFirestore();

    // Create 3 test match requests
    for (let index = 0; index < 3; index++) {
      await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
        name: `Test Client ${index}`,
        email: `test-limit-${index}@example.com`,
        phone: "555-1234",
        zipcode: "12345",
        estimatedDueDate: { month: "12", day: "25", year: "2025" },
        services: ["birth-doula"],
        submitted: new Date().toISOString(),
        sent: false,
      });
    }

    const { request } = setup({ limit: 2 });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.requests.length).toBe(2);
  });

  it("should respect offset parameter", async () => {
    const firestore = getFirestore();

    // Create 3 test match requests
    // We need to ensure order, so we set submitted dates
    const baseDate = new Date("2025-01-01T12:00:00Z");

    for (let index = 0; index < 3; index++) {
      const date = new Date(baseDate);
      date.setMinutes(baseDate.getMinutes() + index); // i=0 is oldest, i=2 is newest

      await firestore.collection(MATCH_REQUESTS_COLLECTION).add({
        name: `Test Client ${index}`,
        email: `test-offset-${index}@example.com`,
        phone: "555-1234",
        zipcode: "12345",
        estimatedDueDate: { month: "12", day: "25", year: "2025" },
        services: ["birth-doula"],
        submitted: date.toISOString(),
        sent: false,
      });
    }

    // List sorts by submitted desc.
    // i=2 (newest) -> first
    // i=1 (middle) -> second
    // i=0 (oldest) -> third

    // Offset 1 should skip the newest (i=2) and return i=1 and i=0
    const { request } = setup({ offset: 1, limit: 10 });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: "all" | "pending" | "processed";
      }>,
    );

    expect(result.requests.length).toBe(2);
    expect(result.requests[0]?.name).toBe("Test Client 1");
    expect(result.requests[1]?.name).toBe("Test Client 0");
  });
});
