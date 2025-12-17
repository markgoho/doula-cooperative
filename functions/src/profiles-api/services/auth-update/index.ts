import { getAuth } from "firebase-admin/auth";
import type { AuthUpdateService as AuthUpdateServiceInterface } from "./interface.js";

/**
 * Update a user's display name in Firebase Auth.
 */
async function updateDisplayNameImpl(uid: string, displayName: string) {
  const auth = getAuth();
  await auth.updateUser(uid, { displayName });
}

export const AuthUpdateService: AuthUpdateServiceInterface = {
  updateDisplayName: updateDisplayNameImpl,
};
