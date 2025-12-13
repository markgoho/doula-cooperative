import { afterAll, describe, expect, it } from "bun:test";
import type { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { MESSAGES_COLLECTION } from "../collections/index.js";
import {
  type ContactUsForm,
  type ContactUsFormDocument,
  type ContactUsFormRequest,
} from "./types.js";
import { contactUsForm } from "../index.js"; // Import from index.ts to test lazy-loading layer
import {
  cleanupTestDocumentsByEmail,
  getDocumentByEmail,
} from "../test-utils/firestore-helpers.js";
import { createMockResponse } from "../test-utils/mock-response.js";
import {
  assertCorsHeaders,
  assertSuccessStatus,
} from "../test-utils/shared-assertions.js";
import { initializeTest } from "../test-utils/test-setup.js";

const test = initializeTest();

function setup({
  contactName = "Test User",
  email = "testcontact@example.com",
  message = "This is a test message",
  includeRecaptcha = true,
} = {}) {
  const formData: ContactUsForm = {
    contactName,
    email,
    message,
    ...(includeRecaptcha ? { recaptchaToken: "test_token" } : {}),
  };
  const firestore = getFirestore();

  // Set up mock environment for reCAPTCHA
  if (includeRecaptcha) {
    process.env["RECAPTCHA_SECRET_KEY"] = "test_secret_key";
    // Mock successful reCAPTCHA verification
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            score: 0.9,
          }),
      });
    }) as unknown as typeof fetch;
    // Store original fetch to restore later
    (globalThis as { _originalFetch?: typeof fetch })._originalFetch =
      originalFetch;
  }

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
  // Restore original fetch if it was mocked
  const original = (globalThis as { _originalFetch?: typeof fetch })
    ._originalFetch;
  if (original) {
    globalThis.fetch = original;
    delete (globalThis as { _originalFetch?: typeof fetch })._originalFetch;
  }

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
    expect(messageDocument).toBeDefined();
    if (messageDocument) {
      expect(messageDocument.exists).toBe(true);
    }

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
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
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
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
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
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
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
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
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
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
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
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
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

  it("should return 400 when recaptchaToken is missing", async () => {
    // Arrange
    const { firestore, request, response, mockResponse } = setup({
      includeRecaptcha: false,
    });

    // Act
    await contactUsForm(request, response);

    // Assert
    expect(mockResponse.statusCode).toBe(400);

    await cleanupContactUsForm({ firestore });
  });

  it("should save submission with low reCAPTCHA score", async () => {
    // Arrange
    const { firestore, request, response, mockResponse, formData } = setup();
    process.env["RECAPTCHA_SECRET_KEY"] = "test_secret_key";

    // Mock low reCAPTCHA score
    globalThis.fetch = (() => {
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            score: 0.3,
          }),
      });
    }) as unknown as typeof fetch;

    // Act
    await contactUsForm(request, response);

    // Assert - Should return 200 (not 403)
    expect(mockResponse.statusCode).toBe(200);

    // Verify document was saved with score
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
      email: formData.email,
    });
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.recaptchaScore).toBe(0.3);
    expect(data.sent).toBe(false);

    await cleanupContactUsForm({ firestore });
  });

  it("should store recaptchaScore in Firestore", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();
    // Default setup mocks score: 0.9

    // Act
    await contactUsForm(request, response);

    // Assert
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
      email: formData.email,
    });
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(data.recaptchaScore).toBe(0.9);

    await cleanupContactUsForm({ firestore });
  });

  it("should not store recaptchaToken in Firestore", async () => {
    // Arrange
    const { formData, firestore, request, response } = setup();

    // Act
    await contactUsForm(request, response);

    // Assert - check that recaptchaToken is not in Firestore
    const messageDocument = await getDocumentByEmail({
      firestore,
      collection: MESSAGES_COLLECTION,
      email: formData.email,
    });
    expect(messageDocument).toBeDefined();
    if (!messageDocument) {
      throw new Error("messageDocument is undefined");
    }
    const data = messageDocument.data() as ContactUsFormDocument;
    expect(
      (data as { recaptchaToken?: string }).recaptchaToken,
    ).toBeUndefined();

    await cleanupContactUsForm({ firestore });
  });
});
