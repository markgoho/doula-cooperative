import firebaseFunctionsTest from "firebase-functions-test";

// Configure emulators (must be set before initializing)
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

/**
 * Initialize firebase-functions-test with emulator configuration
 */
export function initializeTest() {
  return firebaseFunctionsTest(
    {
      projectId: "doula-cooperative-test",
    },
    "./service-account-key.json", // This can be a dummy path for emulator
  );
}

export const MEMBERS_COLLECTION = "members";
export const IMPORT_COLLECTION = "migrated_users_import";
