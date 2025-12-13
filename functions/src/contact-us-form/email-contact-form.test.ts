import { type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { MESSAGES_COLLECTION } from "../collections/index.js";
import { handleDocumentCreated } from "./email-contact-form.js";
import { type ContactUsFormDocument } from "./types.js";
import {
  cleanupFirestoreTriggerTest,
  initializeFirestoreTriggerTest,
} from "../test-utils/test-setup.js";

let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeFirestoreTriggerTest();
});

afterAll(async () => {
  await cleanupFirestoreTriggerTest();
});

function setup({
  contactName = "Test Contact",
  email = "testemailcontact@example.com",
  message = "Test message for email trigger",
} = {}) {
  return {
    contactName,
    email,
    message,
    messageId: `test-${Date.now().toString()}`,
  };
}

describe("emailContactForm", () => {
  beforeEach(() => {
    // Ensure emulator flag is set so we don't try to send real emails
    process.env["FUNCTIONS_EMULATOR"] = "true";
  });

  it("should update sent field to true after processing", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const { contactName, email, message, messageId } = setup();
      const database = context.firestore();
      const reference = doc(database, `${MESSAGES_COLLECTION}/${messageId}`);

      await setDoc(reference, {
        contactName,
        email,
        message,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { messageId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert
      const updatedDocument = await getDoc(reference);
      const data = updatedDocument.data() as ContactUsFormDocument;
      expect(data.sent).toBe(true);
    });
  });

  it("should handle document with contactName field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const { contactName, email, message, messageId } = setup({
        contactName: "Jane Smith",
      });
      const database = context.firestore();
      const reference = doc(database, `${MESSAGES_COLLECTION}/${messageId}`);

      await setDoc(reference, {
        contactName,
        email,
        message,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { messageId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert
      const updatedDocument = await getDoc(reference);
      expect(updatedDocument.exists()).toBe(true);
    });
  });

  it("should handle document with email field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const { contactName, email, message, messageId } = setup({
        email: "testemailcontact123@example.com",
      });
      const database = context.firestore();
      const reference = doc(database, `${MESSAGES_COLLECTION}/${messageId}`);

      await setDoc(reference, {
        contactName,
        email,
        message,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { messageId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert
      const updatedDocument = await getDoc(reference);
      expect(updatedDocument.exists()).toBe(true);
    });
  });

  it("should handle document with message field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const { contactName, email, message, messageId } = setup({
        message: "Custom test message",
      });
      const database = context.firestore();
      const reference = doc(database, `${MESSAGES_COLLECTION}/${messageId}`);

      await setDoc(reference, {
        contactName,
        email,
        message,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { messageId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert
      const updatedDocument = await getDoc(reference);
      expect(updatedDocument.exists()).toBe(true);
    });
  });

  it("should not fail when snapshot is undefined", async () => {
    // Arrange
    const event = {
      data: undefined,
      params: { messageId: "test" },
    };

    // Act & Assert - should not throw
    await handleDocumentCreated(
      event as unknown as Parameters<typeof handleDocumentCreated>[0],
      process.env["MAILGUN_API_KEY"],
    );
  });

  it("should skip email for low reCAPTCHA score", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const { contactName, email, message, messageId } = setup();
      const database = context.firestore();
      const reference = doc(database, `${MESSAGES_COLLECTION}/${messageId}`);

      await setDoc(reference, {
        contactName,
        email,
        message,
        submitted: new Date().toISOString(),
        sent: false,
        recaptchaScore: 0.3, // Low score
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { messageId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert - sent should remain false
      const updatedDocument = await getDoc(reference);
      const data = updatedDocument.data() as ContactUsFormDocument;
      expect(data.sent).toBe(false);
    });
  });

  it("should send email for high reCAPTCHA score", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const { contactName, email, message, messageId } = setup();
      const database = context.firestore();
      const reference = doc(database, `${MESSAGES_COLLECTION}/${messageId}`);

      await setDoc(reference, {
        contactName,
        email,
        message,
        submitted: new Date().toISOString(),
        sent: false,
        recaptchaScore: 0.9, // High score
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { messageId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert - sent should be true
      const updatedDocument = await getDoc(reference);
      const data = updatedDocument.data() as ContactUsFormDocument;
      expect(data.sent).toBe(true);
    });
  });
});
