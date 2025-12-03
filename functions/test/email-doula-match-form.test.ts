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
import { MATCH_REQUESTS_COLLECTION } from "../src/collections/index.js";
import { handleDocumentCreated } from "../src/doula-match-form/email-doula-match.js";
import { type DoulaMatchFormDocument } from "../src/doula-match-form/types.js";
import {
  cleanupFirestoreTriggerTest,
  initializeFirestoreTriggerTest,
} from "../src/test-utils/test-setup.js";

let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeFirestoreTriggerTest();
});

afterAll(async () => {
  await cleanupFirestoreTriggerTest();
});

function setup({
  name = "Test User",
  phone = "555-1234",
  email = "testdoulamatch@example.com",
  zipcode = "12345",
  estimatedDueDate = {
    month: "12",
    day: "25",
    year: "2025",
  },
  services = ["Birth Doula", "Postpartum Doula"],
  birthLocation = "Hospital",
  otherInfo = "Test additional info",
  insurance = ["Medicaid"],
} = {}) {
  return {
    name,
    phone,
    email,
    zipcode,
    estimatedDueDate,
    services,
    birthLocation,
    otherInfo,
    insurance,
    matchRequestId: `test-${Date.now().toString()}`,
  };
}

describe("emailDoulaMatch", () => {
  beforeEach(() => {
    process.env["FUNCTIONS_EMULATOR"] = "true";
  });

  it("should update sent field to true after processing", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const {
        name,
        phone,
        email,
        zipcode,
        estimatedDueDate,
        services,
        birthLocation,
        otherInfo,
        insurance,
        matchRequestId,
      } = setup();
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${matchRequestId}`,
      );

      await setDoc(reference, {
        name,
        phone,
        email,
        zipcode,
        estimatedDueDate,
        services,
        birthLocation,
        otherInfo,
        insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert
      const updatedDocument = await getDoc(reference);
      const data = updatedDocument.data() as DoulaMatchFormDocument;
      expect(data.sent).toBe(true);
    });
  });

  it("should handle document with name field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ name: "Jane Doe" });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with phone field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ phone: "555-9876" });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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
      const formData = setup({ email: "testdoulamatch123@example.com" });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with zipcode field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ zipcode: "54321" });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with estimatedDueDate field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({
        estimatedDueDate: { month: "6", day: "15", year: "2026" },
      });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with services field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ services: ["Birth Doula"] });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with birthLocation field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ birthLocation: "Home" });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with otherInfo field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ otherInfo: "Custom additional information" });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with insurance field", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ insurance: ["Private Insurance"] });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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

  it("should handle document with empty insurance array", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup({ insurance: [] });
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
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
      params: { matchRequestId: "test" },
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
      const formData = setup();
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
        recaptchaScore: 0.3, // Low score
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert - sent should remain false
      const updatedDocument = await getDoc(reference);
      const data = updatedDocument.data() as DoulaMatchFormDocument;
      expect(data.sent).toBe(false);
    });
  });

  it("should send email for high reCAPTCHA score", async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      // Arrange
      const formData = setup();
      const database = context.firestore();
      const reference = doc(
        database,
        `${MATCH_REQUESTS_COLLECTION}/${formData.matchRequestId}`,
      );

      await setDoc(reference, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        zipcode: formData.zipcode,
        estimatedDueDate: formData.estimatedDueDate,
        services: formData.services,
        birthLocation: formData.birthLocation,
        otherInfo: formData.otherInfo,
        insurance: formData.insurance,
        submitted: new Date().toISOString(),
        sent: false,
        recaptchaScore: 0.9, // High score
      });

      const snapshot = await getDoc(reference);

      const event = {
        data: snapshot,
        params: { matchRequestId: formData.matchRequestId },
      };

      // Act
      await handleDocumentCreated(
        event as unknown as Parameters<typeof handleDocumentCreated>[0],
        process.env["MAILGUN_API_KEY"],
      );

      // Assert - sent should be true
      const updatedDocument = await getDoc(reference);
      const data = updatedDocument.data() as DoulaMatchFormDocument;
      expect(data.sent).toBe(true);
    });
  });
});
