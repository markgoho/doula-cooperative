import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  ForbiddenError,
  HttpError,
} from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { VerifyEmailResponse } from "../schemas/member-schemas.js";
import type { VerifyEmailService } from "../services/verify-email/interface.js";

/**
 * Route logic for POST /:memberId/verify-email
 *
 * Marks a member's email as verified in Firebase Auth.
 * Uses verifyOwnerOrAdmin for initial auth (consistent with other member routes),
 * then explicitly rejects non-owner tokens to restrict this security-sensitive
 * action to the account holder only.
 * Idempotent: returns success if the email is already verified.
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
}): Promise<VerifyEmailResponse> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    // Only the owner can verify their own email — reject admin
    if (decodedToken.uid !== memberId) {
      throw new ForbiddenError("You can only verify your own email");
    }

    // Idempotent: if already verified, return success without re-verifying
    if (decodedToken.email_verified === true) {
      logger.info("Email already verified, returning success", { memberId });
      return { success: true };
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
      errorType: error?.constructor?.name,
      memberId,
      hasAuthorizationHeader: Boolean(authorizationHeader),
    });

    set.status = 500;
    return { error: "Failed to verify email" };
  }
}
