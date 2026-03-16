import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { HttpError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import type { AuthService } from "@doula-coop/functions-shared/shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import type { NewsletterService } from "../services/newsletter/interface.js";

/**
 * Update newsletter preference logic (authenticated).
 * Requires authentication - users can update their own preference, admins can update any member.
 *
 * @returns Success response or error object
 */
export async function updateNewsletterPreferenceLogic({
  memberId,
  subscribed,
  newsletterService,
  authService,
  emailService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  subscribed: boolean;
  newsletterService: NewsletterService;
  authService: AuthService;
  emailService: EmailServiceInterface;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<{ success: true; subscribed: boolean } | { error: string }> {
  try {
    // Verify authentication and authorization using injected service
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    // Audit log successful access
    const isAdmin = decodedToken["admin"] === true;
    logger.info("Authorized newsletter preference update", {
      requestingUser: decodedToken.uid,
      targetMember: memberId,
      isAdmin,
      subscribed,
    });

    // Read MailerLite API key from environment
    const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];

    if (!mailerliteApiKey) {
      logger.error("Newsletter service not configured", {
        errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_MISSING_API_KEY,
        memberId,
        subscribed,
      });
      throw new HttpError(
        "Newsletter service not configured. Please contact support.",
        503,
      );
    }

    // Call service layer
    const result = await newsletterService.updateNewsletterPreference({
      memberId,
      subscribed,
      mailerliteApiKey,
      emailService,
      logger,
    });

    return { success: true, ...result };
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Log unexpected errors with context
    logger.error("Failed to update newsletter preference", {
      errorId: ERROR_IDS.UPDATE_NEWSLETTER_PREF_ROUTE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
      subscribed,
      hasAuthorizationHeader: Boolean(authorizationHeader),
    });

    set.status = 500;
    return { error: "Failed to update newsletter preference" };
  }
}
