import { getApps, initializeApp } from "firebase-admin/app";
import firebaseFunctionsTest from "firebase-functions-test";

// Configure emulators (must be set before initializing)
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

/**
 * Initialize firebase-functions-test with emulator configuration
 * Also initializes Firebase Admin SDK if not already initialized
 */
export function initializeTest() {
  // Initialize Firebase Admin if needed (for HTTP functions that access Firestore directly)
  if (getApps().length === 0) {
    initializeApp({ projectId: "doula-cooperative-test" });
  }

  return firebaseFunctionsTest(
    {
      projectId: "doula-cooperative-test",
    },
    "./service-account-key.json", // This can be a dummy path for emulator
  );
}
