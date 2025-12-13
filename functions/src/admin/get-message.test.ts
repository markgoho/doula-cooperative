import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { MESSAGES_COLLECTION } from "../collections/messages.js";
import { adminGetMessage } from "../index.js";
import { createMockCallableRequest } from "../test-utils/mock-request.js";
import { initializeTest } from "../test-utils/test-setup.js";

const test = initializeTest();
const wrapped = test.wrap(adminGetMessage);

function setup({ id = "test-message-id", uid = "test-admin-uid" } = {}) {
  const request = createMockCallableRequest({
    data: { id },
    uid,
    email: "admin@example.com",
    emailVerified: true,
    isAdmin: true,
  });

  return { request, id };
}

describe("adminGetMessage", () => {
  beforeEach(async () => {
    // Clean up any existing test data
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection(MESSAGES_COLLECTION)
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

  it("should throw error when message does not exist", async () => {
    const { request } = setup({ id: "non-existent-id" });

    try {
      await wrapped(request as unknown as CallableRequest<{ id: string }>);
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toContain(
          "Message with ID non-existent-id not found",
        );
      }
    }
  });

  it("should return message by id", async () => {
    const firestore = getFirestore();

    // Create test message
    const documentReference = await firestore
      .collection(MESSAGES_COLLECTION)
      .add({
        contactName: "Test User",
        email: "test-get@example.com",
        message: "This is a test message",
        submitted: new Date().toISOString(),
        sent: false,
      });

    const { request } = setup({ id: documentReference.id });
    const result = await wrapped(
      request as unknown as CallableRequest<{ id: string }>,
    );

    expect(result.id).toBe(documentReference.id);
  });

  it("should include id field in returned data", async () => {
    const firestore = getFirestore();

    const documentReference = await firestore
      .collection(MESSAGES_COLLECTION)
      .add({
        contactName: "Test User",
        email: "test-id-field@example.com",
        message: "Test message",
        submitted: new Date().toISOString(),
        sent: false,
      });

    const { request } = setup({ id: documentReference.id });
    const result = await wrapped(
      request as unknown as CallableRequest<{ id: string }>,
    );

    expect(result).toHaveProperty("id");
  });

  it("should return all message fields", async () => {
    const firestore = getFirestore();

    const testData = {
      contactName: "Test User",
      email: "test-fields@example.com",
      message: "This is a comprehensive test message with all fields",
      submitted: new Date().toISOString(),
      sent: false,
    };

    const documentReference = await firestore
      .collection(MESSAGES_COLLECTION)
      .add(testData);

    const { request } = setup({ id: documentReference.id });
    const result = await wrapped(
      request as unknown as CallableRequest<{ id: string }>,
    );

    expect(result.contactName).toBe(testData.contactName);
    expect(result.email).toBe(testData.email);
    expect(result.message).toBe(testData.message);
    expect(result.submitted).toBe(testData.submitted);
    expect(result.sent).toBe(testData.sent);
  });
});
