import type { CallableRequest } from "firebase-functions/v2/https";

/**
 * Create a mock CallableRequest for testing
 */
export function createMockCallableRequest({
  data,
  uid,
  email,
  emailVerified = true,
}: {
  data?: unknown;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
} = {}): CallableRequest {
  return {
    data,
    auth: uid
      ? {
          uid,
          token: {
            email,
            email_verified: emailVerified,
          },
        }
      : undefined,
    rawRequest: {} as CallableRequest["rawRequest"],
    acceptsStreaming: false,
  } as CallableRequest;
}

