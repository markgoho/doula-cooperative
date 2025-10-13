/**
 * Mock Response for testing HTTP functions
 * This is a minimal mock that implements only the methods we need for testing
 */
export interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  set(key: string, value: string): MockResponse;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
}

/**
 * Create a mock response object for testing HTTP functions
 */
export function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 0,
    headers: {},
    body: undefined,
    set(this: MockResponse, key: string, value: string): MockResponse {
      this.headers[key] = value;
      return this;
    },
    status(this: MockResponse, code: number): MockResponse {
      this.statusCode = code;
      return this;
    },
    send(this: MockResponse, body: unknown): MockResponse {
      this.body = body;
      return this;
    },
  };

  return response;
}
