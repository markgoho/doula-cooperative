import type { CallableRequest } from "firebase-functions/v2/https";

/**
 * Create a mock CallableRequest for testing
 */
export function createMockCallableRequest({
  data,
  uid,
  email,
  emailVerified = true,
  isAdmin = false,
}: {
  data?: unknown;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
} = {}): CallableRequest {
  return {
    data,
    auth: uid
      ? {
          uid,
          token: {
            email,
            email_verified: emailVerified,
            admin: isAdmin,
          },
        }
      : undefined,
    rawRequest: {} as CallableRequest["rawRequest"],
    acceptsStreaming: false,
  } as CallableRequest;
}

