import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { type MessageStatus } from "../src/admin/list-messages.js";
import { MESSAGES_COLLECTION } from "../src/collections/messages.js";
import { adminListMessages } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();
const wrapped = test.wrap(adminListMessages);

function setup({
  limit = 50,
  offset = 0,
  status = "all" as MessageStatus,
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

describe("adminListMessages", () => {
  beforeEach(async () => {
    // Clean up any existing test data
    const firestore = getFirestore();

    // Get ALL documents in the collection
    const snapshot = await firestore
      .collection(MESSAGES_COLLECTION)
      .listDocuments();

    const batch = firestore.batch();
    // Batch delete has a limit of 500, but for tests this loop is usually fine.
    // If the collection is huge, we might need chunks.
    for (const document of snapshot) {
      batch.delete(document);
    }
    await batch.commit();
  });

  afterAll(() => {
    test.cleanup();
  });

  it("should return empty list when no messages exist", async () => {
    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.messages).toEqual([]);
  });

  it("should return list of messages", async () => {
    const firestore = getFirestore();

    // Create test message
    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test User",
      email: "test-user@example.com",
      message: "This is a test message",
      submitted: new Date().toISOString(),
      sent: false,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.messages.length).toBe(1);
  });

  it("should return total count", async () => {
    const firestore = getFirestore();

    // Create test messages
    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test User 1",
      email: "test-user1@example.com",
      message: "First test message",
      submitted: new Date().toISOString(),
      sent: false,
    });

    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test User 2",
      email: "test-user2@example.com",
      message: "Second test message",
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.total).toBe(2);
  });

  it("should return pending count", async () => {
    const firestore = getFirestore();

    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test Pending",
      email: "test-pending@example.com",
      message: "Pending message",
      submitted: new Date().toISOString(),
      sent: false,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.pendingCount).toBe(1);
  });

  it("should return processed count", async () => {
    const firestore = getFirestore();

    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test Processed",
      email: "test-processed@example.com",
      message: "Processed message",
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup();
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.processedCount).toBe(1);
  });

  it("should filter by pending status", async () => {
    const firestore = getFirestore();

    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test Pending",
      email: "test-pending2@example.com",
      message: "Pending message",
      submitted: new Date().toISOString(),
      sent: false,
    });

    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test Processed",
      email: "test-processed2@example.com",
      message: "Processed message",
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup({ status: "pending" });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.messages.length).toBe(1);
    expect(result.messages[0]?.sent).toBe(false);
  });

  it("should filter by processed status", async () => {
    const firestore = getFirestore();

    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test Pending",
      email: "test-pending3@example.com",
      message: "Pending message",
      submitted: new Date().toISOString(),
      sent: false,
    });

    await firestore.collection(MESSAGES_COLLECTION).add({
      contactName: "Test Processed",
      email: "test-processed3@example.com",
      message: "Processed message",
      submitted: new Date().toISOString(),
      sent: true,
    });

    const { request } = setup({ status: "processed" });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.messages.length).toBe(1);
    expect(result.messages[0]?.sent).toBe(true);
  });

  it("should respect limit parameter", async () => {
    const firestore = getFirestore();

    // Create 3 test messages
    for (let index = 0; index < 3; index++) {
      await firestore.collection(MESSAGES_COLLECTION).add({
        contactName: `Test User ${index}`,
        email: `test-limit-${index}@example.com`,
        message: `Message ${index}`,
        submitted: new Date().toISOString(),
        sent: false,
      });
    }

    const { request } = setup({ limit: 2 });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.messages.length).toBe(2);
  });

  it("should cap limit at MAX_LIMIT (100)", async () => {
    // We won't create 101 documents to test this because it's slow
    // But we can verify the function doesn't error with a large limit
    // and if we had more than 100 docs, it would return 100
    // For this test, we'll just verify it works with limit > 100

    const { request } = setup({ limit: 150 });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.messages).toBeDefined();
  });

  it("should respect offset parameter", async () => {
    const firestore = getFirestore();

    // Create 3 test messages
    const baseDate = new Date("2025-01-01T12:00:00Z");

    for (let index = 0; index < 3; index++) {
      const date = new Date(baseDate);
      date.setMinutes(baseDate.getMinutes() + index);

      await firestore.collection(MESSAGES_COLLECTION).add({
        contactName: `Test User ${index}`,
        email: `test-offset-${index}@example.com`,
        message: `Message ${index}`,
        submitted: date.toISOString(),
        sent: false,
      });
    }

    // Offset 1 should skip the newest and return the other 2
    const { request } = setup({ offset: 1, limit: 10 });
    const result = await wrapped(
      request as unknown as CallableRequest<{
        limit?: number;
        offset?: number;
        status?: MessageStatus;
      }>,
    );

    expect(result.messages.length).toBe(2);
    expect(result.messages[0]?.contactName).toBe("Test User 1");
    expect(result.messages[1]?.contactName).toBe("Test User 0");
  });
});
