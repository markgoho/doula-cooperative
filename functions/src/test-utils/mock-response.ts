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
