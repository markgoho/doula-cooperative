import { afterAll, describe, expect, it } from "bun:test";
import type { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { contactUsForm } from "../src"; // Import from index.ts to test lazy-loading layer
import { MESSAGES_COLLECTION } from "../src/constants";
import {
  type ContactUsForm,
  type ContactUsFormDocument,
  type ContactUsFormRequest,
  type MockResponse,
} from "../src/contact-us-form/types";
import { initializeTest } from "../src/test-utils/test-setup";

const test = initializeTest();

function setup({
  contactName = "Test User",
  email = "testcontact@example.com",
  message = "This is a test message",
} = {}) {
  const formData: ContactUsForm = {
    contactName,
    email,
    message,
  };
  const firestore = getFirestore();

  // Create mock request and response objects
  const request: ContactUsFormRequest = {
    body: formData,
  } as ContactUsFormRequest;

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

async function getMessageDocument({
  firestore,
  email,
}: {
  firestore: ReturnType<typeof getFirestore>;
  email: string;
}) {
  const messages = await firestore
    .collection(MESSAGES_COLLECTION)
    .where("email", "==", email)
    .get();

  return messages.docs[0];
}

async function cleanupContactUsForm({
  firestore,
}: {
  firestore: ReturnType<typeof getFirestore>;
}) {
  const testMessages = await firestore
    .collection(MESSAGES_COLLECTION)
    .where("email", ">=", "testcontact")
    .where("email", "<", "testcontact\uF8FF")
    .get();

  const deletePromises = testMessages.docs.map(document =>
    document.ref.delete(),
  );
  await Promise.all(deletePromises);
}

describe("contactUsForm", () => {
  afterAll(() => {
    test.cleanup();
  });

  it("should create a message document in Firestore", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getMessageDocument({
      firestore,
      email: formData.email,
    });
    expect(messageDocument.exists).toBe(true);

    await cleanupContactUsForm({ firestore });
  });

  it("should store contactName field correctly", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup({
      contactName: "Jane Doe",
    });

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getMessageDocument({
      firestore,
      email: formData.email,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.contactName).toBe("Jane Doe");

    await cleanupContactUsForm({ firestore });
  });

  it("should store email field correctly", async () => {
    // Arrange
    const testEmail = "testcontact123@example.com";
    const { firestore, request, response } = setup({ email: testEmail });

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getMessageDocument({
      firestore,
      email: testEmail,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.email).toBe(testEmail);

    await cleanupContactUsForm({ firestore });
  });

  it("should store message field correctly", async () => {
    // Arrange
    const testMessage = "I need help with finding a doula";
    const { formData, firestore, request, response } = setup({
      message: testMessage,
    });

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getMessageDocument({
      firestore,
      email: formData.email,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.message).toBe(testMessage);

    await cleanupContactUsForm({ firestore });
  });

  it("should set sent field to false", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getMessageDocument({
      firestore,
      email: formData.email,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.sent).toBe(false);

    await cleanupContactUsForm({ firestore });
  });

  it("should set submitted timestamp", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getMessageDocument({
      firestore,
      email: formData.email,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.submitted).toBeDefined();

    await cleanupContactUsForm({ firestore });
  });

  it("should set submitted timestamp as string", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getMessageDocument({
      firestore,
      email: formData.email,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(typeof data.submitted).toBe("string");

    await cleanupContactUsForm({ firestore });
  });

  it("should return 200 status on success", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    expect(mockResponse.statusCode).toBe(200);

    await cleanupContactUsForm({ firestore });
  });

  it("should set Access-Control-Allow-Origin header", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    expect(mockResponse.headers["Access-Control-Allow-Origin"]).toBe("*");

    await cleanupContactUsForm({ firestore });
  });

  it("should set Access-Control-Allow-Methods header", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    expect(mockResponse.headers["Access-Control-Allow-Methods"]).toBe("POST");

    await cleanupContactUsForm({ firestore });
  });

  it("should set Access-Control-Allow-Headers header", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    expect(mockResponse.headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type",
    );

    await cleanupContactUsForm({ firestore });
  });
});
