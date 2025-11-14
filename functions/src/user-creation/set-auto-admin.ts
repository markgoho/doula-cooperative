import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { type auth } from "firebase-functions/v1";

const ADMIN_EMAIL = "webmaster@doulacooperative.com";

export async function handleSetAutoAdmin(user: auth.UserRecord) {
  try {
    const { uid, email } = user;

    if (!email) {
      logger.log(`User ${uid} has no email, skipping auto-admin check`);
      return;
    }

    // Check if the email matches the admin email
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      logger.log(`User ${uid} (${email}) is not the admin email, skipping`);
      return;
    }

    const authService = getAuth();

    // Set the admin custom claim
    await authService.setCustomUserClaims(uid, { admin: true });

    logger.log(
      `Auto-granted admin claim to user: ${uid} (${email}) on user creation`,
    );
  } catch (error: unknown) {
    logger.error("Error setting auto-admin claim:", error);
    throw error;
  }
}
