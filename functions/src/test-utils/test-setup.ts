import {
  type RulesTestEnvironment,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getApps, initializeApp } from "firebase-admin/app";
import firebaseFunctionsTest from "firebase-functions-test";

// Configure emulators (must be set before initializing)
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

export const TEST_PROJECT_ID = "doula-cooperative-test";

/**
 * Initialize firebase-functions-test with emulator configuration
 * Also initializes Firebase Admin SDK if not already initialized
 */
export function initializeTest() {
  // Initialize Firebase Admin if needed (for HTTP functions that access Firestore directly)
  if (getApps().length === 0) {
    initializeApp({ projectId: TEST_PROJECT_ID });
  }

  return firebaseFunctionsTest(
    {
      projectId: TEST_PROJECT_ID,
    },
    "./service-account-key.json", // This can be a dummy path for emulator
  );
}

let testEnvironment: RulesTestEnvironment | undefined;

/**
 * Initialize test environment for Firestore trigger functions
 * Uses @firebase/rules-unit-testing for creating test documents
 */
export async function initializeFirestoreTriggerTest() {
  // Initialize Firebase Admin SDK for the handler to use
  if (getApps().length === 0) {
    initializeApp({ projectId: TEST_PROJECT_ID });
  }

  testEnvironment ??= await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
    },
  });

  return testEnvironment;
}

/**
 * Cleanup test environment
 */
export async function cleanupFirestoreTriggerTest() {
  if (testEnvironment) {
    await testEnvironment.cleanup();
    testEnvironment = undefined;
  }
}
