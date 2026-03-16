import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../errors/http-error.js";

/**
 * Firestore error codes that we handle specifically.
 * @see https://firebase.google.com/docs/reference/node/firebase.firestore#firestoreerrorcode
 */
interface FirestoreError {
  code: string;
  message: string;
}

function isFirestoreError(error: unknown): error is FirestoreError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

/**
 * Handle Firestore operation errors with specific error messages.
 *
 * @param error - The error thrown by Firestore
 * @param operation - Description of the operation (e.g., "update member")
 * @param resourceId - ID of the resource being operated on
 * @throws NotFoundError if document was deleted during operation
 * @throws ForbiddenError if permission denied
 * @throws ValidationError if quota exceeded
 * @throws Original error for other cases (to be handled by route handler)
 */
export function handleFirestoreError(
  error: unknown,
  operation: string,
  resourceId: string,
): never {
  if (!isFirestoreError(error)) {
    throw error;
  }

  switch (error.code) {
    case "not-found": {
      throw new NotFoundError(
        `Resource ${resourceId} was deleted during ${operation}. Please refresh and try again.`,
      );
    }

    case "permission-denied": {
      throw new ForbiddenError(
        `Insufficient permissions to ${operation} for ${resourceId}`,
      );
    }

    case "resource-exhausted": {
      throw new ValidationError(
        `Database quota exceeded. Please try again later.`,
      );
    }

    case "failed-precondition": {
      throw new ValidationError(
        `Operation failed: ${error.message}. The resource may be in an invalid state.`,
      );
    }

    case "aborted": {
      throw new ValidationError(
        `Operation ${operation} was aborted due to a conflict. Please try again.`,
      );
    }

    default: {
      throw new Error(`Firestore operation failed: ${error.message}`, {
        cause: error,
      });
    }
  }
}

/**
 * Validate that a Firestore document exists and has data.
 *
 * @param snapshot - Document snapshot from Firestore
 * @param resourceType - Type of resource (e.g., "member")
 * @param resourceId - ID of the resource
 * @returns Document data
 * @throws NotFoundError if document doesn't exist or has no data
 */
export function validateDocumentData<T>(
  snapshot: { exists: boolean; data: () => T | undefined; id: string },
  resourceType: string,
  resourceId: string,
): T {
  if (!snapshot.exists) {
    throw new NotFoundError(
      `${resourceType} ${resourceId} was deleted during the operation. Please refresh and try again.`,
    );
  }

  const data = snapshot.data();
  if (!data) {
    throw new Error(
      `${resourceType} ${resourceId} exists but has no data. This indicates data corruption.`,
    );
  }

  return data;
}

/**
 * Validate required fields exist in document data.
 *
 * @param data - Document data object
 * @param requiredFields - Array of required field names
 * @param resourceType - Type of resource (e.g., "member")
 * @param resourceId - ID of the resource
 * @throws Error if any required fields are missing
 */
export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[],
  resourceType: string,
  resourceId: string,
): void {
  const missingFields = requiredFields.filter(
    field => data[field] === undefined,
  );

  if (missingFields.length > 0) {
    throw new Error(
      `${resourceType} ${resourceId} is missing required fields: ${missingFields.join(", ")}. This indicates data corruption.`,
    );
  }
}
