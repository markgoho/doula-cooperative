import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { MESSAGES_COLLECTION } from "../src/collections/messages.js";
import { adminUpdateMessage } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";

const test = initializeTest();
const wrapped = test.wrap(adminUpdateMessage);

function setup({
  id = "test-message-id",
  sent = true,
  uid = "test-admin-uid",
} = {}) {
  const request = createMockCallableRequest({
    data: { id, sent },
    uid,
    email: "admin@example.com",
    emailVerified: true,
    isAdmin: true,
  });

  return { request, id, sent };
}

describe("adminUpdateMessage", () => {
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
      await wrapped(
        request as unknown as CallableRequest<{ id: string; sent: boolean }>,
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toContain(
          "Message with ID non-existent-id not found",
        );
      }
    }
  });

  it("should update sent field to true", async () => {
    const firestore = getFirestore();

    // Create test message
    const documentReference = await firestore
      .collection(MESSAGES_COLLECTION)
      .add({
        contactName: "Test User",
        email: "test-update-true@example.com",
        message: "Test message",
        submitted: new Date().toISOString(),
        sent: false,
      });

    const { request } = setup({ id: documentReference.id, sent: true });
    await wrapped(
      request as unknown as CallableRequest<{ id: string; sent: boolean }>,
    );

    // Verify the update
    const updatedDocument = await documentReference.get();
    const data = updatedDocument.data();
    expect(data?.["sent"]).toBe(true);
  });

  it("should update sent field to false", async () => {
    const firestore = getFirestore();

    // Create test message with sent: true
    const documentReference = await firestore
      .collection(MESSAGES_COLLECTION)
      .add({
        contactName: "Test User",
        email: "test-update-false@example.com",
        message: "Test message",
        submitted: new Date().toISOString(),
        sent: true,
      });

    const { request } = setup({ id: documentReference.id, sent: false });
    await wrapped(
      request as unknown as CallableRequest<{ id: string; sent: boolean }>,
    );

    // Verify the update
    const updatedDocument = await documentReference.get();
    const data = updatedDocument.data();
    expect(data?.["sent"]).toBe(false);
  });

  it("should only update sent field and not other fields", async () => {
    const firestore = getFirestore();

    const originalData = {
      contactName: "Test User",
      email: "test-update-only-sent@example.com",
      message: "Original message content",
      submitted: new Date().toISOString(),
      sent: false,
    };

    const documentReference = await firestore
      .collection(MESSAGES_COLLECTION)
      .add(originalData);

    const { request } = setup({ id: documentReference.id, sent: true });
    await wrapped(
      request as unknown as CallableRequest<{ id: string; sent: boolean }>,
    );

    // Verify only sent field changed
    const updatedDocument = await documentReference.get();
    const data = updatedDocument.data();
    expect(data?.["contactName"]).toBe(originalData.contactName);
    expect(data?.["email"]).toBe(originalData.email);
    expect(data?.["message"]).toBe(originalData.message);
    expect(data?.["submitted"]).toBe(originalData.submitted);
    expect(data?.["sent"]).toBe(true);
  });

  it("should return success message", async () => {
    const firestore = getFirestore();

    const documentReference = await firestore
      .collection(MESSAGES_COLLECTION)
      .add({
        contactName: "Test User",
        email: "test-success-message@example.com",
        message: "Test message",
        submitted: new Date().toISOString(),
        sent: false,
      });

    const { request } = setup({ id: documentReference.id, sent: true });
    const result = await wrapped(
      request as unknown as CallableRequest<{ id: string; sent: boolean }>,
    );

    expect(result.success).toBe(true);
  });
});
