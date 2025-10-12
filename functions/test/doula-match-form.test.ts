import { afterAll, describe, expect, it } from "bun:test";
import type { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { doulaMatchForm } from "../src"; // Import from index.ts to test lazy-loading layer
import { MATCH_REQUESTS_COLLECTION } from "../src/constants";
import {
  type DoulaMatchForm,
  type DoulaMatchFormDocument,
  type DoulaMatchFormRequest,
} from "../src/doula-match-form/types";
import { type MockResponse } from "../src/test-utils/mock-response";
import { initializeTest } from "../src/test-utils/test-setup";

const test = initializeTest();

function setup({
  name = "Test Parent",
  phone = "555-1234",
  email = "testmatch@example.com",
  zipcode = "12345",
  estimatedDueDate = { month: "12", day: "25", year: "2025" },
  services = ["Birth Support", "Postpartum Care"],
  birthLocation = "Hospital",
  otherInfo = "Looking for experienced doula",
  insurance = ["Blue Cross", "Medicaid"],
} = {}) {
  const formData: DoulaMatchForm = {
    name,
    phone,
    email,
    zipcode,
    estimatedDueDate,
    services,
    birthLocation,
    otherInfo,
    insurance,
  };
  const firestore = getFirestore();

  // Create mock request and response objects
  const request: DoulaMatchFormRequest = {
    body: formData,
  } as DoulaMatchFormRequest;

  const response: MockResponse = {
    statusCode: 0,
    headers: {},
    body: undefined,
    set(this: MockResponse, key: string, value: string): MockResponse {
      this.headers[key] = value;
      return this;
    },
    status(this: MockResponse, code: number): MockResponse {
      this.statusCode = code;
      return this;
    },
    send(this: MockResponse, body: unknown): MockResponse {
      this.body = body;
      return this;
    },
  };

  return {
    formData,
    firestore,
    request,
    response: response as unknown as Response,
    mockResponse: response,
  };
}

async function getMatchRequestDocument({
  firestore,
  email,
}: {
  firestore: ReturnType<typeof getFirestore>;
  email: string;
}) {
  const matchRequests = await firestore
    .collection(MATCH_REQUESTS_COLLECTION)
    .where("email", "==", email)
    .get();

  return matchRequests.docs[0];
}

async function cleanupDoulaMatchForm({
  firestore,
}: {
  firestore: ReturnType<typeof getFirestore>;
}) {
  const testMatchRequests = await firestore
    .collection(MATCH_REQUESTS_COLLECTION)
    .where("email", ">=", "testmatch")
    .where("email", "<", "testmatch\uF8FF")
    .get();

  const deletePromises = testMatchRequests.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("doulaMatchForm", () => {
  afterAll(() => {
    test.cleanup();
  });

  it("should create a match request document in Firestore", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    expect(matchRequestDocument.exists).toBe(true);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store name field correctly", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup({
      name: "Jane Smith",
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.name).toBe("Jane Smith");

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store phone field correctly", async () => {
    // Arrange
    const testPhone = "555-9876";
    const { formData, firestore, request, response } = setup({
      phone: testPhone,
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.phone).toBe(testPhone);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store email field correctly", async () => {
    // Arrange
    const testEmail = "testmatch123@example.com";
    const { firestore, request, response } = setup({ email: testEmail });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: testEmail,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.email).toBe(testEmail);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store zipcode field correctly", async () => {
    // Arrange
    const testZipcode = "90210";
    const { formData, firestore, request, response } = setup({
      zipcode: testZipcode,
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.zipcode).toBe(testZipcode);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store estimatedDueDate field correctly", async () => {
    // Arrange
    const testDueDate = { month: "06", day: "15", year: "2026" };
    const { formData, firestore, request, response } = setup({
      estimatedDueDate: testDueDate,
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.estimatedDueDate).toEqual(testDueDate);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store services array correctly", async () => {
    // Arrange
    const testServices = ["Birth Support", "Prenatal Visits"];
    const { formData, firestore, request, response } = setup({
      services: testServices,
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.services).toEqual(testServices);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store birthLocation field correctly", async () => {
    // Arrange
    const testLocation = "Home Birth";
    const { formData, firestore, request, response } = setup({
      birthLocation: testLocation,
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.birthLocation).toBe(testLocation);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store otherInfo field correctly", async () => {
    // Arrange
    const testInfo = "First time parent, need guidance";
    const { formData, firestore, request, response } = setup({
      otherInfo: testInfo,
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.otherInfo).toBe(testInfo);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should store insurance array correctly", async () => {
    // Arrange
    const testInsurance = ["Aetna", "UnitedHealthcare"];
    const { formData, firestore, request, response } = setup({
      insurance: testInsurance,
    });

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.insurance).toEqual(testInsurance);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should set submitted timestamp", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(data.submitted).toBeDefined();

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should set submitted timestamp as string", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await doulaMatchForm(request, response);

    // Assert
    const matchRequestDocument = await getMatchRequestDocument({
      firestore,
      email: formData.email,
    });
    const data = matchRequestDocument.data() as DoulaMatchFormDocument;
    expect(typeof data.submitted).toBe("string");

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should return 200 status on success", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await doulaMatchForm(request, response);

    // Assert
    expect(mockResponse.statusCode).toBe(200);

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should set Access-Control-Allow-Origin header", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await doulaMatchForm(request, response);

    // Assert
    expect(mockResponse.headers["Access-Control-Allow-Origin"]).toBe("*");

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should set Access-Control-Allow-Methods header", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await doulaMatchForm(request, response);

    // Assert
    expect(mockResponse.headers["Access-Control-Allow-Methods"]).toBe("POST");

    await cleanupDoulaMatchForm({ firestore });
  });

  it("should set Access-Control-Allow-Headers header", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await doulaMatchForm(request, response);

    // Assert
    expect(mockResponse.headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type",
    );

    await cleanupDoulaMatchForm({ firestore });
  });
});
