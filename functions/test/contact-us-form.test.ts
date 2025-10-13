import { afterAll, describe, expect, it } from "bun:test";
import type { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { contactUsForm } from "../src"; // Import from index.ts to test lazy-loading layer
import { MESSAGES_COLLECTION } from "../src/constants";
import {
  type ContactUsForm,
  type ContactUsFormDocument,
  type ContactUsFormRequest,
} from "../src/contact-us-form/types";
import {
  cleanupTestDocumentsByEmail,
  getDocumentByEmail,
} from "../src/test-utils/firestore-helpers";
import { createMockResponse } from "../src/test-utils/mock-response";
import {
  assertCorsHeaders,
  assertSuccessStatus,
} from "../src/test-utils/shared-assertions";
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

  const mockResponse = createMockResponse();

  return {
    formData,
    firestore,
    request,
    response: mockResponse as unknown as Response,
    mockResponse,
  };
}

async function cleanupContactUsForm({
  firestore,
}: {
  firestore: ReturnType<typeof getFirestore>;
}) {
  await cleanupTestDocumentsByEmail({
    firestore,
    collection: MESSAGES_COLLECTION,
    emailPrefix: "testcontact",
  });
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
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
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
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
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
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
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
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
      email: formData.email,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.message).toBe(testMessage);

    await cleanupContactUsForm({ firestore });
  });

  it("should set sent field as boolean", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
      email: formData.email,
    });
    const data = messageDocument.data() as ContactUsFormDocument;
    // The HTTP function writes sent:false, but emailContactForm trigger may fire
    // immediately in the emulator and update it to true, so we just verify it exists
    expect(typeof data.sent).toBe("boolean");

    await cleanupContactUsForm({ firestore });
  });

  it("should set submitted timestamp", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
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
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
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
    assertSuccessStatus(mockResponse);

    await cleanupContactUsForm({ firestore });
  });

  it("should set CORS headers correctly", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert
    assertCorsHeaders(mockResponse);

    await cleanupContactUsForm({ firestore });
  });
});
