import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { MATCH_REQUESTS_COLLECTION } from "../collections/match-requests.js";
import { adminGetMatchRequest } from "../index.js";
import { createMockCallableRequest } from "../test-utils/mock-request.js";
import { initializeTest } from "../test-utils/test-setup.js";

const test = initializeTest();
const wrapped = test.wrap(adminGetMatchRequest);

function setup({ id = "test-match-request-id", uid = "test-admin-uid" } = {}) {
  const request = createMockCallableRequest({
    data: { id },
    uid,
    email: "admin@example.com",
    emailVerified: true,
    isAdmin: true,
  });

  return { request, id };
}

describe("adminGetMatchRequest", () => {
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

  it("should throw error when match request does not exist", async () => {
    const { request } = setup({ id: "non-existent-id" });

    try {
      await wrapped(request as unknown as CallableRequest<{ id: string }>);
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).toContain(
          "Match request with ID non-existent-id not found",
        );
      }
    }
  });

  it("should return match request by id", async () => {
    const firestore = getFirestore();

    // Create test match request
    const documentReference = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .add({
        name: "Test Client",
        email: "test-get@example.com",
        phone: "555-1234",
        zipcode: "12345",
        estimatedDueDate: {
          month: "12",
          day: "25",
          year: "2025",
        },
        services: ["birth-doula"],
        birthLocation: "Test Hospital",
        insurance: ["Insurance A"],
        otherInfo: "Test notes",
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
      .collection(MATCH_REQUESTS_COLLECTION)
      .add({
        name: "Test Client",
        email: "test-id-field@example.com",
        phone: "555-1234",
        zipcode: "12345",
        estimatedDueDate: { month: "12", day: "25", year: "2025" },
        services: ["birth-doula"],
        submitted: new Date().toISOString(),
        sent: false,
      });

    const { request } = setup({ id: documentReference.id });
    const result = await wrapped(
      request as unknown as CallableRequest<{ id: string }>,
    );

    expect(result).toHaveProperty("id");
  });

  it("should return all match request fields", async () => {
    const firestore = getFirestore();

    const testData = {
      name: "Test Client",
      email: "test-fields@example.com",
      phone: "555-1234",
      zipcode: "12345",
      estimatedDueDate: {
        month: "12",
        day: "25",
        year: "2025",
      },
      services: ["birth-doula", "postpartum-doula"],
      birthLocation: "Test Hospital",
      insurance: ["Insurance A", "Insurance B"],
      otherInfo: "Test notes",
      submitted: new Date().toISOString(),
      sent: false,
    };

    const documentReference = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .add(testData);

    const { request } = setup({ id: documentReference.id });
    const result = await wrapped(
      request as unknown as CallableRequest<{ id: string }>,
    );

    expect(result.name).toBe(testData.name);
    expect(result.email).toBe(testData.email);
    expect(result.phone).toBe(testData.phone);
    expect(result.zipcode).toBe(testData.zipcode);
    expect(result.services).toEqual(testData.services);
    expect(result.birthLocation).toBe(testData.birthLocation);
    expect(result.insurance).toEqual(testData.insurance);
    expect(result.otherInfo).toBe(testData.otherInfo);
    expect(result.sent).toBe(testData.sent);
  });
});
