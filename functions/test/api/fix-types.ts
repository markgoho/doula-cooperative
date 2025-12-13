// Helper to create a complete DecodedIdToken for tests
import type { DecodedIdToken } from "firebase-admin/auth";

export function createMockDecodedToken(
  overrides: Partial<DecodedIdToken> = {},
): DecodedIdToken {
  return {
    uid: "test-uid",
    aud: "test-project",
    auth_time: 1_234_567_890,
    exp: 1_234_567_890,
    iat: 1_234_567_890,
    sub: "test-uid",
    firebase: {
      identities: {},
      sign_in_provider: "password",
    },
    ...overrides,
  } as DecodedIdToken;
}
