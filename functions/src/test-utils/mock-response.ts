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
  json(body: unknown): MockResponse;
}

/**
 * Create a mock response object for testing HTTP functions
 */
export function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 0,
    headers: {},
    body: undefined,
    set(key: string, value: string): MockResponse {
      response.headers[key] = value;
      return response;
    },
    status(code: number): MockResponse {
      response.statusCode = code;
      return response;
    },
    send(body: unknown): MockResponse {
      response.body = body;
      return response;
    },
    json(body: unknown): MockResponse {
      response.body = body;
      return response;
    },
  };

  return response;
}
