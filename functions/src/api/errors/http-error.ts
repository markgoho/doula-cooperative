/**
 * Base class for HTTP errors with status codes.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * 401 Unauthorized - Authentication is required or has failed.
 */
export class AuthError extends HttpError {
  constructor(message: string) {
    super(message, 401);
  }
}

/**
 * 403 Forbidden - User is authenticated but lacks permissions.
 */
export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(message, 403);
  }
}

/**
 * 404 Not Found - Resource does not exist.
 */
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(message, 404);
  }
}

/**
 * 400 Bad Request - Invalid input or validation failure.
 */
export class ValidationError extends HttpError {
  constructor(message: string) {
    super(message, 400);
  }
}
