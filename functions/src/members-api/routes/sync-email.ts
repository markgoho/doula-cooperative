import { FieldValue } from "firebase-admin/firestore";
import { ADMIN_EMAIL } from "../../constants/admin.js";
import { NO_REPLY_EMAIL } from "../../constants/email-addresses.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  ForbiddenError,
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { MemberFirestoreService } from "../../shared-api/services/member-firestore/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";

export type SyncEmailResponse =
  | { success: true; synced: boolean; email: string }
  | { error: string };

export async function syncEmailLogic({
  memberId,
  authService,
  memberFirestoreService,
  emailService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  authService: AuthService;
  memberFirestoreService: MemberFirestoreService;
  emailService: EmailServiceInterface;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<SyncEmailResponse> {
  let authEmail: string | undefined;

  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    if (decodedToken.uid !== memberId) {
      throw new ForbiddenError("You can only sync your own email");
    }

    const email = decodedToken.email;
    if (typeof email !== "string" || email === "") {
      throw new ForbiddenError(
        "Authenticated user does not have an email address",
      );
    }
    authEmail = email;

    const document = await memberFirestoreService.getMemberByUid(memberId);
    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    const member = document.data() as { email?: unknown };
    const storedEmail =
      typeof member.email === "string" ? member.email : undefined;
    if (storedEmail === email) {
      return { success: true, synced: false, email };
    }

    try {
      await memberFirestoreService.updateMember(memberId, {
        email,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (firestoreError) {
      // CRITICAL: Firebase Auth email has already been updated by the client
      // before calling this endpoint. A Firestore write failure here means
      // the user's sign-in email and their member document email are out of
      // sync — affecting Stripe, Mailgun, and profile lookups.
      logger.error(
        "Failed to sync member email to Firestore after Auth update",
        {
          errorId: ERROR_IDS.SYNC_MEMBER_EMAIL_FIRESTORE_FAILED,
          error: firestoreError,
          errorMessage:
            firestoreError instanceof Error
              ? firestoreError.message
              : "Unknown error",
          errorStack:
            firestoreError instanceof Error ? firestoreError.stack : undefined,
          errorType: firestoreError?.constructor?.name,
          memberId,
          authEmail: email,
          firestoreEmail: storedEmail,
          severity: "CRITICAL",
          actionRequired:
            "Member's Firebase Auth email diverged from Firestore. Manually update the member document email to match their sign-in email.",
        },
      );

      await sendEmailDivergenceAdminNotification({
        emailService,
        memberId,
        authEmail: email,
        firestoreEmail: storedEmail ?? "(unknown)",
        logger,
      });

      set.status = 500;
      return {
        error:
          "Your sign-in email was updated, but we could not refresh your membership email. Our team has been notified.",
      };
    }

    return { success: true, synced: true, email };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // If authEmail is defined, auth verification succeeded and the caller's
    // Firebase Auth email has already been updated to `authEmail`. Any failure
    // past that point (e.g., the Firestore read) leaves Auth and Firestore
    // diverged — treat it with the same CRITICAL severity + admin alert path
    // as a Firestore write failure.
    const isDivergence = authEmail !== undefined;
    logger.error(
      isDivergence
        ? "Failed to sync member email after Auth update (divergence)"
        : "Failed to sync member email",
      {
        errorId: ERROR_IDS.SYNC_MEMBER_EMAIL_ROUTE_FAILED,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        memberId,
        authEmail,
        hasAuthorizationHeader: Boolean(authorizationHeader),
        ...(isDivergence && {
          severity: "CRITICAL",
          actionRequired:
            "Member's Firebase Auth email may have diverged from Firestore. Verify and reconcile manually.",
        }),
      },
    );

    if (isDivergence && authEmail !== undefined) {
      await sendEmailDivergenceAdminNotification({
        emailService,
        memberId,
        authEmail,
        firestoreEmail: "(unknown — Firestore read failed)",
        logger,
      });
      set.status = 500;
      return {
        error:
          "Your sign-in email was updated, but we could not refresh your membership email. Our team has been notified.",
      };
    }

    set.status = 500;
    return { error: "Failed to sync member email" };
  }
}

async function sendEmailDivergenceAdminNotification({
  emailService,
  memberId,
  authEmail,
  firestoreEmail,
  logger,
}: {
  emailService: EmailServiceInterface;
  memberId: string;
  authEmail: string;
  firestoreEmail: string;
  logger: Logger;
}): Promise<void> {
  try {
    const html = `
      <h2>Member Email Sync Failed</h2>
      <p>A member changed their sign-in email, but the Firestore update failed. Their auth and member records are now out of sync.</p>
      <ul>
        <li><strong>Member UID:</strong> ${escapeHtml(memberId)}</li>
        <li><strong>New sign-in email:</strong> ${escapeHtml(authEmail)}</li>
        <li><strong>Stored member email:</strong> ${escapeHtml(firestoreEmail)}</li>
      </ul>
      <p><strong>Action:</strong> Manually update the member document email to match the sign-in email, or investigate why the Firestore write failed.</p>
    `;

    await emailService.sendEmail(
      {
        message: {
          from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
          to: ADMIN_EMAIL,
          subject: `CRITICAL: Member email sync failed for ${authEmail}`,
          html,
        },
      },
      logger,
    );
  } catch (notificationError) {
    logger.error("Failed to send email-sync admin notification", {
      errorId: ERROR_IDS.SYNC_MEMBER_EMAIL_ADMIN_NOTIFICATION_FAILED,
      error: notificationError,
      errorMessage:
        notificationError instanceof Error
          ? notificationError.message
          : "Unknown error",
      errorStack:
        notificationError instanceof Error
          ? notificationError.stack
          : undefined,
      memberId,
      authEmail,
      severity: "CRITICAL",
      actionRequired:
        "Both the Firestore sync and the admin notification failed. Investigate member email divergence manually.",
    });
  }
}
