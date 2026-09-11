/**
 * Firebase Functions HttpsError codes
 * @see https://firebase.google.com/docs/reference/node/firebase.functions.FunctionsErrorCode
 */
export type FirebaseFunctionsErrorCode =
  | 'ok'
  | 'cancelled'
  | 'unknown'
  | 'invalid-argument'
  | 'deadline-exceeded'
  | 'not-found'
  | 'already-exists'
  | 'permission-denied'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'aborted'
  | 'out-of-range'
  | 'unimplemented'
  | 'internal'
  | 'unavailable'
  | 'data-loss'
  | 'unauthenticated';

/**
 * Firebase Functions error structure
 */
export interface FirebaseFunctionsError {
  code: FirebaseFunctionsErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Type guard to check if an error is a Firebase Functions error
 */
export function isFirebaseFunctionsError(error: unknown): error is FirebaseFunctionsError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}
