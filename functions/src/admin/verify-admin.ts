import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

/**
 * Helper function to verify that the request is from an authenticated admin user.
 * Throws an HttpsError if the user is not authenticated or not an admin.
 *
 * @param context - The CallableRequest context
 * @throws HttpsError if not authenticated or not admin
 */
export function verifyAdmin(context: CallableRequest): void {
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be authenticated to call this function.",
    );
  }

  if (!context.auth.token["admin"]) {
    throw new HttpsError(
      "permission-denied",
      "This function requires admin privileges.",
    );
  }
}
