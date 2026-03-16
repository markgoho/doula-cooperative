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
  const request = {
    data,
    auth: uid
      ? {
          uid,
          token: {
            ...(email !== undefined && { email }),
            email_verified: emailVerified,
            admin: isAdmin,
          },
          rawToken: "",
        }
      : undefined,
    rawRequest: {} as CallableRequest["rawRequest"],
    acceptsStreaming: false,
  };
  // Use double assertion for test mocks - DecodedIdToken has many required properties
  // we don't need for testing, so we only mock the parts we actually use
  return request as unknown as CallableRequest;
}
