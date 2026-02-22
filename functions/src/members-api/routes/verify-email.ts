import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  ForbiddenError,
  HttpError,
  ValidationError,
} from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { VerifyEmailService } from "../services/verify-email/interface.js";

/**
 * Route logic for POST /:memberId/verify-email
 *
 * Marks a member's email as verified in Firebase Auth.
 * Owner-only: the authenticated user's UID must match the memberId.
 * Admin access is explicitly denied — admins should not verify emails on behalf of members.
 * Rejects requests when the email is already verified to prevent misuse.
 */
export async function verifyEmailLogic({
  memberId,
  authService,
  verifyEmailService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  authService: AuthService;
  verifyEmailService: VerifyEmailService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<{ success: true } | { error: string }> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    // Only the owner can verify their own email — reject admin
    if (decodedToken.uid !== memberId) {
      throw new ForbiddenError("You can only verify your own email");
    }

    // Reject if email is already verified — prevents misuse by already-verified users
    if (decodedToken.email_verified === true) {
      throw new ValidationError("Email is already verified");
    }

    await verifyEmailService.markEmailVerified(memberId);

    logger.info("Email marked as verified", { memberId });

    return { success: true };
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to verify email", {
      errorId: ERROR_IDS.VERIFY_EMAIL_ROUTE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
    });

    set.status = 500;
    return { error: "Failed to verify email" };
  }
}
