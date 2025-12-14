import type { AuthService as AuthServiceInterface } from "./interface.js";
import { verifyAdmin } from "./verify-admin.js";
import { verifyOwnerOrAdmin } from "./verify-owner-or-admin.js";
import { verifyAuthToken } from "./verify-token.js";

/**
 * Service for authentication and authorization operations.
 * Decoupled from HTTP framework - does not depend on Elysia Context.
 *
 * Each method is in a separate file to comply with the "one export per module" rule.
 */
export const AuthService: AuthServiceInterface = {
  verifyAuthToken,
  verifyAdmin,
  verifyOwnerOrAdmin,
};

// Re-export individual functions for direct imports

export { verifyAdmin } from "./verify-admin.js";
export { verifyOwnerOrAdmin } from "./verify-owner-or-admin.js";
export { verifyAuthToken } from "./verify-token.js";
