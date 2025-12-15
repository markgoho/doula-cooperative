import { request } from '@playwright/test';

export interface MockUser {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
  password?: string;
}

export interface MockMemberDocument {
  uid: string;
  email: string;
  name?: string;
  createdAt: { seconds: number; nanoseconds: number };
  subscriptionStart?: { seconds: number; nanoseconds: number };
  membershipActive?: boolean;
  slug?: string;
  lastPayment?: { seconds: number; nanoseconds: number };
  nextPayment?: { seconds: number; nanoseconds: number };
  membershipExpiresAt?: { seconds: number; nanoseconds: number };
  newsletterSubscribed?: boolean;
}

/**
 * Firebase emulator URLs for e2e tests.
 * These MUST match the emulator configuration in firebase.json at the repository root.
 *
 * Default ports:
 * - Auth: 9099
 * - Firestore: 8080
 * - Functions: 5001
 *
 * If you change emulator ports in firebase.json, update these constants accordingly.
 */
const AUTH_EMULATOR_URL = 'http://localhost:9099';
const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';
const PROJECT_ID = 'doula-cooperative';

/**
 * Default timeout for all API requests to Firebase emulators (5 seconds).
 * This prevents tests from hanging if emulators are slow or unresponsive.
 */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Convert plain JavaScript object to Firestore REST API wire format.
 *
 * The Firestore REST API requires typed field objects rather than plain values.
 * For example, `{ name: "Alice" }` must be converted to
 * `{ name: { stringValue: "Alice" } }`.
 *
 * Supported types:
 * - string -> stringValue
 * - number -> integerValue (as string)
 * - boolean -> booleanValue
 * - {seconds, nanoseconds} -> timestampValue (ISO 8601)
 * - null/undefined -> nullValue
 *
 * @param data - Plain object with primitive values
 * @returns Firestore wire format object with typed fields
 * @throws Error if data contains unsupported types (arrays, nested objects, etc.)
 * @see https://firebase.google.com/docs/firestore/reference/rest/v1/Value
 */
function convertToFirestoreFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: String(value) };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value && typeof value === 'object' && 'seconds' in value) {
      const timestamp = value as { seconds: number };
      fields[key] = {
        timestampValue: new Date(timestamp.seconds * 1000).toISOString(),
      };
    } else if (value === null || value === undefined) {
      // Firestore wire format requires null for nullValue
      // eslint-disable-next-line unicorn/no-null
      fields[key] = { nullValue: null };
    } else if (Array.isArray(value)) {
      throw new TypeError(
        `Unsupported type for field '${key}': arrays are not yet supported. ` +
          `Add array handling to convertToFirestoreFields() if needed.`,
      );
    } else if (typeof value === 'object') {
      throw new TypeError(
        `Unsupported type for field '${key}': nested objects are not yet supported. ` +
          `Add nested object handling to convertToFirestoreFields() if needed.`,
      );
    } else {
      throw new TypeError(
        `Unsupported type for field '${key}': ${typeof value}. ` +
          `Supported types: string, number, boolean, timestamp, null/undefined.`,
      );
    }
  }
  return fields;
}

/**
 * Create a user in the Firebase Auth emulator.
 *
 * Uses the Auth emulator REST API to create a user account with email/password
 * authentication. If emailVerified is true, makes an additional API call to
 * update the verification status.
 *
 * @param user - User account details
 * @param user.email - User's email address
 * @param user.password - User's password (defaults to 'test1234' if omitted)
 * @param user.displayName - Optional display name
 * @param user.emailVerified - Whether email should be marked as verified
 * @returns The Firebase Auth UID assigned to the created user
 * @throws Error if the Auth emulator API returns a non-200 response or is unreachable
 *
 * @example
 * const uid = await createAuthUser({
 *   uid: '',
 *   email: 'test@example.com',
 *   emailVerified: true,
 *   password: 'test1234'
 * });
 */
export async function createAuthUser(user: MockUser): Promise<string> {
  const apiContext = await request.newContext();

  try {
    // Create user via Auth emulator REST API
    const response = await apiContext.post(
      `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      {
        data: {
          email: user.email,
          password: user.password || 'test1234',
          displayName: user.displayName || '',
          returnSecureToken: true,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    if (!response.ok()) {
      const text = await response.text();
      throw new Error(
        `Failed to create auth user ${user.email}: ${text}. ` +
          `Verify the Auth emulator is running on ${AUTH_EMULATOR_URL}. ` +
          `Start emulators with: bun run emulators:e2e`,
      );
    }

    const data = await response.json();

    if (!data.localId || typeof data.localId !== 'string') {
      throw new Error(
        `Auth emulator returned unexpected response format. Expected 'localId' field but got: ${JSON.stringify(data)}. ` +
          `This may indicate an emulator version mismatch or API change.`,
      );
    }

    const uid = data.localId;

    // Update email verification status if needed
    if (user.emailVerified) {
      const verifyResponse = await apiContext.post(
        `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-api-key`,
        {
          data: {
            idToken: data.idToken,
            emailVerified: true,
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
      );

      if (!verifyResponse.ok()) {
        const text = await verifyResponse.text();
        throw new Error(
          `Failed to verify email for user ${user.email}: ${text}. ` +
            `This indicates a problem with the Auth emulator or an invalid idToken.`,
        );
      }
    }

    return uid;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Set custom claims on a Firebase Auth user in the emulator.
 *
 * Uses the Auth emulator REST API to set custom claims like admin privileges.
 * Note: The Auth emulator has limited support for custom claims via REST API.
 * This function uses the emulator-specific endpoint format.
 *
 * @param uid - The user's Firebase Auth UID
 * @param customClaims - Custom claims object (e.g., { admin: true })
 * @throws Error if the Auth emulator API returns a non-200 response
 *
 * @example
 * await setCustomClaims('test-uid-123', { admin: true });
 */
export async function setCustomClaims(
  uid: string,
  customClaims: Record<string, unknown>,
): Promise<void> {
  const apiContext = await request.newContext();

  try {
    // Use the emulator's internal API to update user account with custom attributes
    const response = await apiContext.post(
      `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-api-key`,
      {
        data: {
          localId: uid,
          customAttributes: JSON.stringify(customClaims),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    if (!response.ok()) {
      const text = await response.text();
      throw new Error(
        `Failed to set custom claims for uid ${uid}: ${text}. ` +
          `Verify the Auth emulator is running on ${AUTH_EMULATOR_URL}.`,
      );
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Create a member document in the Firestore emulator.
 *
 * Uses the Firestore REST API with 'Bearer owner' auth token to bypass
 * security rules (emulator-only feature). This allows tests to create
 * documents without authentication.
 *
 * @param memberDocument - Member document data to create
 * @throws Error if the Firestore emulator API returns a non-200 response
 * @throws Error if memberDocument contains unsupported field types
 *
 * @example
 * await createMemberDocument({
 *   uid: 'test-uid-123',
 *   email: 'test@example.com',
 *   name: 'Test User',
 *   createdAt: { seconds: 1704067200, nanoseconds: 0 },
 *   membershipActive: true,
 * });
 */
export async function createMemberDocument(
  memberDocument: MockMemberDocument,
): Promise<void> {
  const apiContext = await request.newContext();

  try {
    const fields = convertToFirestoreFields(
      memberDocument as unknown as Record<string, unknown>,
    );

    const response = await apiContext.patch(
      `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/members/${memberDocument.uid}`,
      {
        headers: {
          // 'Bearer owner' is an emulator-only token that bypasses security rules
          // This token has admin access in test environments only
          Authorization: 'Bearer owner',
        },
        data: {
          fields,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    if (!response.ok()) {
      const text = await response.text();
      throw new Error(
        `Failed to create member document for uid ${memberDocument.uid}: ${text}. ` +
          `Verify the Firestore emulator is running on ${FIRESTORE_EMULATOR_URL}. ` +
          `Start emulators with: bun run emulators:e2e`,
      );
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete all users from the Firebase Auth emulator.
 *
 * This is used for test cleanup to ensure a clean slate before each test.
 * Failures are logged but don't throw to avoid masking test failures.
 *
 * @throws Error if the Auth emulator is not running or returns an error
 */
export async function clearAuthEmulator(): Promise<void> {
  const apiContext = await request.newContext();

  try {
    const response = await apiContext.delete(
      `${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`,
      {
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    if (!response.ok() && response.status() !== 404) {
      const text = await response.text();
      throw new Error(
        `Failed to clear Auth emulator: ${text}. ` +
          `Ensure emulators are running with 'bun run emulators:e2e'. ` +
          `You may need to restart the emulators if they are in a bad state.`,
      );
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Clear all Firestore data in the emulator.
 *
 * This is used for test cleanup to ensure a clean slate before each test.
 * Failures are logged but don't throw to avoid masking test failures.
 *
 * @throws Error if the Firestore emulator is not running or returns an error
 */
export async function clearFirestoreData(): Promise<void> {
  const apiContext = await request.newContext();

  try {
    const response = await apiContext.delete(
      `${FIRESTORE_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      {
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    if (!response.ok() && response.status() !== 404) {
      const text = await response.text();
      throw new Error(
        `Failed to clear Firestore emulator: ${text}. ` +
          `Ensure emulators are running with 'bun run emulators:e2e'. ` +
          `You may need to restart the emulators if they are in a bad state.`,
      );
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Clear all emulator data (Auth + Firestore).
 *
 * Runs both cleanup operations and reports all failures. Uses Promise.allSettled
 * to ensure both cleanups complete even if one fails.
 *
 * @throws Error if either cleanup operation fails, with details about all failures
 *
 * @example
 * // Before each test
 * await clearAllEmulatorData();
 *
 * // After each test (in fixture teardown)
 * try {
 *   await clearAllEmulatorData();
 * } catch (error) {
 *   console.error('Cleanup failed:', error);
 * }
 */
export async function clearAllEmulatorData(): Promise<void> {
  const results = await Promise.allSettled([clearAuthEmulator(), clearFirestoreData()]);

  const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

  if (failures.length > 0) {
    const errorMessages = failures.map((f) => f.reason.message).join('\n\n');
    throw new Error(
      `Failed to clear emulator data (${failures.length} of 2 operations failed):\n${errorMessages}`,
    );
  }
}
