/**
 * Minimal Response interface for Firebase Functions HTTP handlers.
 * Captures only the methods used in our codebase, allowing us to
 * remove the express dependency while maintaining type safety.
 *
 * Firebase Functions provides an Express-compatible response object at runtime,
 * but we only need types at compile time. This interface defines the subset
 * of methods we actually use.
 */
export interface FirebaseResponse {
  /**
  Indicates whether headers have already been sent to the client.
  */
  readonly headersSent: boolean;

  /**
  Sets the HTTP status code. Returns this for chaining.
  */
  status(code: number): this;

  /**
  Sets a response header. Returns this for chaining.
  */
  setHeader(name: string, value: string): this;

  /**
  Sends the response body.
  */
  send(body: string | Buffer): void;

  /**
  Sends a JSON response.
  */
  json(body: unknown): void;
}
