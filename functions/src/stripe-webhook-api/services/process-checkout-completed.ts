import type { UserRecord } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import { ADMIN_EMAIL } from "../../constants/admin.js";
import {
  ERROR_IDS,
  FACEBOOK_GROUP_URL,
  MARK_EMAIL,
  NEWSLETTER_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../../constants/index.js";
import { StripeWebhookError } from "../../shared-api/errors/stripe-errors.js";
import type {
  EmailMessage,
  EmailServiceInterface,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { generateSecurePassword } from "../../shared-api/utils/generate-secure-password.js";
import { escapeHtml } from "../../shared-api/utils/html-escape.js";
import {
  addNewsletterSubscriber,
  MailerLiteError,
} from "../../shared-api/utils/mailerlite.js";
import {
  calculateExpirationDate,
  createStripeMemberDocument,
  createStripeMemberUpdate,
} from "../utils/index.js";
import { AuthUpdateService } from "../../profiles-api/services/auth-update/index.js";
import { ClaimProfileFirestoreService } from "../../profiles-api/services/firestore/index.js";
import { applyImportedMemberMerge } from "../../profiles-api/services/imported-member-merge/index.js";
import type { CheckoutCompletedResult } from "./interface.js";

/**
 * Create HTML for MailerLite failure notification email.
 */
function createMailerLiteFailureEmailHtml(options: {
  customerEmail: string;
  customerName: string | null | undefined;
  uid: string;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
}): string {
  const {
    customerEmail,
    customerName,
    uid,
    subscriptionStart,
    membershipExpiresAt,
    errorMessage,
  } = options;

  const displayName = escapeHtml(customerName) || "Not provided";
  const subscriptionStartDate = escapeHtml(
    subscriptionStart.toDate().toISOString(),
  );
  const expirationDate = escapeHtml(membershipExpiresAt.toDate().toISOString());

  return `
    <h2>MailerLite Newsletter Signup Failed</h2>
    <p>A new member completed payment but could not be added to the newsletter automatically.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(customerEmail)}</li>
      <li><strong>Name:</strong> ${displayName}</li>
      <li><strong>UID:</strong> ${escapeHtml(uid)}</li>
      <li><strong>Subscription Start:</strong> ${subscriptionStartDate}</li>
      <li><strong>Membership Expires:</strong> ${expirationDate}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${escapeHtml(errorMessage)}</p>

    <p><strong>Action Required:</strong> Manually add this member to the MailerLite newsletter.</p>
  `;
}

interface FailureNotificationConfig {
  emailService: EmailServiceInterface;
  customerEmail: string;
  customerName: string | null | undefined;
  userRecord: UserRecord;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
  logger: Logger;
}

/**
 * Notify the newsletter admin when MailerLite subscription fails.
 * Errors are caught and logged but never thrown, so notification failure
 * does not affect the webhook response.
 */
async function sendMailerLiteFailureNotification({
  emailService,
  customerEmail,
  customerName,
  userRecord,
  subscriptionStart,
  membershipExpiresAt,
  errorMessage,
  logger,
}: FailureNotificationConfig): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject: "Action Required: Manual Newsletter Signup",
      html: createMailerLiteFailureEmailHtml({
        customerEmail,
        customerName,
        uid: userRecord.uid,
        subscriptionStart,
        membershipExpiresAt,
        errorMessage,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent MailerLite failure notification email", {
      uid: userRecord.uid,
      email: customerEmail,
    });
  } catch (emailError) {
    logger.error("Failed to send MailerLite failure notification", {
      error: emailError,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_MAILERLITE_NOTIFICATION_FAILED,
      uid: userRecord.uid,
      email: customerEmail,
      severity: "CRITICAL",
      actionRequired:
        "Check Sentry alerts immediately - newsletter signup failed and notification failed",
    });
    // Don't throw - we don't want to fail the webhook because email notification failed
  }
}

/**
 * Create HTML for welcome email failure notification.
 */
function createWelcomeEmailFailureEmailHtml(options: {
  customerEmail: string;
  customerName: string | null | undefined;
  uid: string;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
}): string {
  const {
    customerEmail,
    customerName,
    uid,
    subscriptionStart,
    membershipExpiresAt,
    errorMessage,
  } = options;

  const displayName = escapeHtml(customerName) || "Not provided";
  const subscriptionStartDate = escapeHtml(
    subscriptionStart.toDate().toISOString(),
  );
  const expirationDate = escapeHtml(membershipExpiresAt.toDate().toISOString());

  return `
    <h2>Welcome Email Failed</h2>
    <p>A new member completed payment but the welcome email could not be sent. The member's account is active but they have no way to set their password.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(customerEmail)}</li>
      <li><strong>Name:</strong> ${displayName}</li>
      <li><strong>UID:</strong> ${escapeHtml(uid)}</li>
      <li><strong>Subscription Start:</strong> ${subscriptionStartDate}</li>
      <li><strong>Membership Expires:</strong> ${expirationDate}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${escapeHtml(errorMessage)}</p>

    <p><strong>Action Required:</strong> Manually send a welcome email or password reset link to this member so they can access their account.</p>
  `;
}

/**
 * Notify the admin when a welcome email fails for a new member.
 * Errors are caught and logged but never thrown, so notification failure
 * does not affect the webhook response.
 */
async function sendWelcomeEmailFailureNotification({
  emailService,
  customerEmail,
  customerName,
  userRecord,
  subscriptionStart,
  membershipExpiresAt,
  errorMessage,
  logger,
}: FailureNotificationConfig): Promise<void> {
  try {
    const notificationEmail: EmailMessage = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: "Action Required: Welcome Email Failed for New Member",
      html: createWelcomeEmailFailureEmailHtml({
        customerEmail,
        customerName,
        uid: userRecord.uid,
        subscriptionStart,
        membershipExpiresAt,
        errorMessage,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent welcome email failure notification", {
      uid: userRecord.uid,
      email: customerEmail,
    });
  } catch (emailError) {
    logger.error("Failed to send welcome email failure notification", {
      error: emailError,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_WELCOME_EMAIL_NOTIFICATION_FAILED,
      uid: userRecord.uid,
      email: customerEmail,
      severity: "CRITICAL",
      actionRequired:
        "Check Sentry alerts immediately - welcome email failed and notification failed",
    });
    // Don't throw - we don't want to fail the webhook because notification failed
  }
}

/**
 * Create HTML for referral coordinator notification email.
 */
function createReferralCoordinatorEmailHtml(options: {
  customerEmail: string;
  customerName: string | null | undefined;
}): string {
  const { customerEmail, customerName } = options;
  const displayName = escapeHtml(customerName) || "Not provided";

  return `
    <h2>New Member Joined the Cooperative</h2>
    <p>A new member has completed their payment and joined the Rochester Doula Cooperative. Please watch for their Facebook group join request.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Name:</strong> ${displayName}</li>
      <li><strong>Email:</strong> ${escapeHtml(customerEmail)}</li>
    </ul>

    <p><strong>Action Required:</strong> The member has been asked to join the
    <a href="${FACEBOOK_GROUP_URL}">private Facebook group</a>.
    Please approve their request when you see it.</p>
  `;
}

/**
 * Notify the referrals coordinator when a new member joins.
 * Errors are caught and logged but never thrown, so notification failure
 * does not affect the webhook response.
 */
async function sendReferralCoordinatorNotification(options: {
  emailService: EmailServiceInterface;
  customerEmail: string;
  customerName: string | null | undefined;
  uid: string;
  logger: Logger;
}): Promise<void> {
  const { emailService, customerEmail, customerName, uid, logger } = options;

  try {
    const notificationEmail: EmailMessage = {
      from: `Rochester Doula Cooperative <${NO_REPLY_EMAIL}>`,
      to: REFERRAL_EMAIL,
      subject: "New Member Joined \u2014 Watch for Facebook Group Request",
      html: createReferralCoordinatorEmailHtml({
        customerEmail,
        customerName,
      }),
    };

    await emailService.sendEmail({ message: notificationEmail }, logger);
    logger.info("Sent referral coordinator notification email", {
      uid,
      email: customerEmail,
    });
  } catch (emailError) {
    logger.error("Failed to send referral coordinator notification", {
      error: emailError,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_REFERRAL_NOTIFICATION_FAILED,
      uid,
      email: customerEmail,
      severity: "CRITICAL",
      actionRequired:
        "Check Sentry alerts immediately - new member joined but coordinator was not notified",
    });
    // Don't throw - we don't want to fail the webhook because notification failed
  }
}

/**
 * Generate welcome email HTML content.
 */
function generateWelcomeEmailHtml(resetLink: string): string {
  return `
    <h2>Welcome to the Rochester Doula Cooperative!</h2>
    <p>Your membership is now active. Thank you for joining our community of professional birth workers!</p>

    <p><strong>Next Step: Set Your Password</strong></p>
    <p>Click the link below to access your member portal and create your password:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>

    <p>This link will expire in 1 hour. If you need a new link, you can request one from the sign-in page.</p>

    <p>Once you've set your password, you'll be able to:</p>
    <ul>
      <li>Access member resources</li>
      <li>Connect with other doulas</li>
      <li>Manage your profile</li>
      <li>Stay updated on cooperative events</li>
    </ul>

    <p><strong>Join Our Private Facebook Group</strong></p>
    <p>Connect with your fellow cooperative members! Visit
    <a href="${FACEBOOK_GROUP_URL}">our Facebook group</a> and request to join.
    Our coordinator will approve your request once she sees you in the members list.</p>

    <p>If you have any questions, please reach out to us at ${MARK_EMAIL}.</p>

    <p>Welcome aboard!</p>
    <p>The Rochester Doula Cooperative Team</p>
  `;
}

/**
 * Send welcome email to new member.
 */
async function sendWelcomeEmail(options: {
  email: string;
  uid: string;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<void> {
  const { email, uid, emailService, logger } = options;
  const auth = getAuth();

  let resetLink: string;
  try {
    resetLink = await auth.generatePasswordResetLink(email, {
      url: "https://members.doulacooperative.com/membership",
    });
  } catch (error) {
    logger.error("Failed to generate password reset link", {
      error,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_PASSWORD_RESET_LINK_FAILED,
      uid,
      email,
    });
    throw new Error(`Failed to generate password reset link for ${email}`);
  }

  const emailMessage: EmailMessage = {
    from: `Rochester Doula Cooperative <${NO_REPLY_EMAIL}>`,
    to: email,
    subject: "Welcome to Rochester Doula Cooperative!",
    html: generateWelcomeEmailHtml(resetLink),
  };

  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping email dispatch.");
    logger.info(`Would have sent welcome email to: ${email}`);
    logger.info(`Password reset link: ${resetLink}`);
  } else {
    try {
      await emailService.sendEmail({ message: emailMessage }, logger);
      logger.info(`Welcome email sent to: ${email}`);
    } catch (error) {
      logger.error("Failed to send welcome email via Mailgun", {
        error,
        errorId: ERROR_IDS.STRIPE_WEBHOOK_EMAIL_FAILED,
        uid,
        email,
      });
      throw new Error(`Failed to send welcome email to ${email}`);
    }
  }
}

/**
 * Process a checkout.session.completed event.
 * Creates/updates user and member, adds to newsletter, sends welcome email.
 */
export async function processCheckoutCompleted(options: {
  session: Stripe.Checkout.Session;
  emailService: EmailServiceInterface;
  logger: Logger;
}): Promise<CheckoutCompletedResult> {
  const { session, emailService, logger } = options;
  const database = getFirestore();
  const auth = getAuth();

  const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];

  // Get email from customer_details (customer_email is often null in real webhooks)
  const customerEmail =
    session.customer_details?.email ?? session.customer_email;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!customerEmail) {
    logger.error("No customer email in checkout session", {
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MISSING_EMAIL,
      customerId,
    });
    throw new StripeWebhookError("Missing customer email", 400);
  }

  // Prefer custom field name over cardholder name (which may be a business name)
  const customNameField = session.custom_fields.find(
    field => field.key === "firstandlastname",
  );
  const customerName =
    customNameField?.text?.value ?? session.customer_details?.name;

  logger.info(`Processing membership for: ${customerEmail}`);

  let userRecord: UserRecord | undefined;
  let isNewUser = false;
  let warning: string | undefined;

  // Step 1: Look up or create user
  try {
    userRecord = await auth.getUserByEmail(customerEmail);
    logger.info(`User already exists: ${customerEmail} (${userRecord.uid})`);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
      isNewUser = true;
      logger.info(`User not found, will create new user for: ${customerEmail}`);
    } else {
      logger.error("Failed to look up user in Firebase Auth", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_AUTH_LOOKUP_FAILED,
        customerEmail,
        customerId,
      });
      throw new StripeWebhookError("Unable to verify account status", 500);
    }
  }

  // Step 2: Create user if needed
  if (isNewUser) {
    try {
      const temporaryPassword = generateSecurePassword();

      userRecord = await auth.createUser({
        email: customerEmail,
        emailVerified: false,
        password: temporaryPassword,
        ...(customerName && {
          displayName: customerName,
        }),
      });

      logger.info(`Created user: ${userRecord.uid}`);

      // Set admin claim if email matches admin email
      const isAdmin = customerEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (isAdmin) {
        try {
          await auth.setCustomUserClaims(userRecord.uid, { admin: true });
          logger.info(`Auto-granted admin claim to user: ${userRecord.uid}`);
        } catch (claimError) {
          logger.error("Failed to set admin claim for new user", {
            error: claimError,
            errorMessage:
              claimError instanceof Error
                ? claimError.message
                : "Unknown error",
            errorId: ERROR_IDS.API_STRIPE_WEBHOOK_ADMIN_CLAIM_FAILED,
            uid: userRecord.uid,
            customerEmail,
            severity: "HIGH",
            actionRequired: "Manually set admin claim via Firebase Console",
          });

          // Track in member document for recovery
          try {
            await getFirestore()
              .collection(MEMBERS_COLLECTION)
              .doc(userRecord.uid)
              .set(
                {
                  adminClaimStatus: "pending",
                  adminClaimError:
                    claimError instanceof Error
                      ? claimError.message
                      : "Unknown error",
                  adminClaimFailedAt: Timestamp.now(),
                },
                { merge: true },
              );
          } catch (trackingError) {
            logger.error("Failed to track admin claim failure", {
              error: trackingError,
              uid: userRecord.uid,
              customerEmail,
              severity: "HIGH",
            });
          }

          // Add warning to response (webhook won't fail, but caller is notified)
          warning = warning
            ? `${warning}; Admin claim failed - manual setup required`
            : "Admin claim failed - manual setup required";
        }
      }
    } catch (error) {
      logger.error("Failed to create user in Firebase Auth", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_USER_CREATE_FAILED,
        customerEmail,
        customerId,
      });
      throw new StripeWebhookError("Unable to create account", 500);
    }
  }

  if (!userRecord) {
    logger.error("User record is undefined after lookup/create", {
      errorId: ERROR_IDS.API_STRIPE_WEBHOOK_UNEXPECTED_ERROR,
      customerEmail,
    });
    throw new StripeWebhookError("Internal server error", 500);
  }

  // Step 3: Create or update member document
  const subscriptionStart = Timestamp.now();
  const membershipExpiresAt = calculateExpirationDate(subscriptionStart);

  if (isNewUser) {
    try {
      const memberDocument = createStripeMemberDocument({
        uid: userRecord.uid,
        email: customerEmail,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "active",
        subscriptionStart,
        membershipExpiresAt,
        ...(customerName && {
          name: customerName,
        }),
      });

      await database
        .collection(MEMBERS_COLLECTION)
        .doc(userRecord.uid)
        .set(memberDocument);
      logger.info(`Created member document for: ${customerEmail}`);
    } catch (error) {
      logger.error("Failed to create member document", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MEMBER_CREATE_FAILED,
        uid: userRecord.uid,
        customerEmail,
        requiresManualIntervention: true,
      });
      throw new StripeWebhookError(
        "Account created but setup incomplete - support will contact you",
        500,
      );
    }
  } else {
    try {
      const memberUpdate = createStripeMemberUpdate({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "active",
        subscriptionStart,
        membershipExpiresAt,
      });

      await database
        .collection(MEMBERS_COLLECTION)
        .doc(userRecord.uid)
        .set(memberUpdate, { merge: true });
      logger.info(`Updated existing member document for: ${customerEmail}`);
    } catch (error) {
      logger.error("Failed to update member document", {
        error,
        errorId: ERROR_IDS.API_STRIPE_WEBHOOK_MEMBER_UPDATE_FAILED,
        uid: userRecord.uid,
        customerEmail,
      });
      throw new StripeWebhookError("Unable to update membership", 500);
    }
  }

  let autoLinkResult:
    | Awaited<ReturnType<typeof applyImportedMemberMerge>>
    | undefined;
  try {
    autoLinkResult = await applyImportedMemberMerge({
      uid: userRecord.uid,
      email: customerEmail,
      emailService,
      firestoreService: ClaimProfileFirestoreService,
      authUpdateService: AuthUpdateService,
      logger,
      source: "stripe_webhook",
    });
  } catch (error) {
    logger.error("Imported member auto-link failed during Stripe checkout", {
      error,
      errorId: ERROR_IDS.CLAIM_PROFILE_FAILED,
      uid: userRecord.uid,
      email: customerEmail,
      actionRequired: "Review imported member merge failure for this checkout",
    });
    warning = "Imported legacy profile could not be auto-linked during checkout";
  }

  if (autoLinkResult !== undefined) {
    switch (autoLinkResult.status) {
      case "merged": {
        logger.info("Auto-linked imported member during Stripe checkout", {
          uid: userRecord.uid,
          email: customerEmail,
          hasSlug: Boolean(autoLinkResult.mergedFields.slug),
        });
        warning = warning ?? autoLinkResult.warning;
        break;
      }
      case "not_found": {
        logger.info("No exact imported member match found during Stripe checkout", {
          uid: userRecord.uid,
          email: customerEmail,
        });
        break;
      }
      case "invalid_import_data": {
        logger.error(
          "Imported member record matched checkout email but could not be merged",
          {
            uid: userRecord.uid,
            email: customerEmail,
            warning: autoLinkResult.warning,
            errorId: ERROR_IDS.CLAIM_PROFILE_INVALID_DATA,
          },
        );
        warning = warning ?? autoLinkResult.warning;
        break;
      }
    }
  }

  // Track non-critical operation results
  let mailerliteSynced = autoLinkResult?.status === "merged" && autoLinkResult.mailerliteSynced;

  // Step 3.5: Add to newsletter (non-critical - don't fail webhook if this fails)
  if (mailerliteApiKey && autoLinkResult?.status !== "merged") {
    try {
      await addNewsletterSubscriber({
        email: customerEmail,
        ...(customerName && { name: customerName }),
        subscriptionStart,
        membershipExpiresAt,
        ...(process.env["MAILERLITE_GROUP_ID"] && {
          groupId: process.env["MAILERLITE_GROUP_ID"],
        }),
        apiKey: mailerliteApiKey,
      });

      logger.info("Added subscriber to MailerLite newsletter", {
        uid: userRecord.uid,
        email: customerEmail,
      });

      // Update member document to track newsletter subscription
      try {
        await database.collection(MEMBERS_COLLECTION).doc(userRecord.uid).set(
          {
            newsletterSubscribed: true,
            newsletterSubscribedAt: Timestamp.now(),
          },
          { merge: true },
        );
        logger.info("Updated member document with newsletter subscription", {
          uid: userRecord.uid,
          email: customerEmail,
        });
        mailerliteSynced = true;
      } catch (firestoreError) {
        // This is a critical failure - MailerLite and Firestore would be out of sync
        logger.error(
          "CRITICAL: Failed to update member document with newsletter status",
          {
            error: firestoreError,
            errorId: ERROR_IDS.STRIPE_WEBHOOK_MEMBER_DOC_UPDATE_FAILED,
            uid: userRecord.uid,
            email: customerEmail,
            context:
              "MailerLite was updated but Firestore sync failed - throwing to trigger webhook retry",
            severity: "CRITICAL",
          },
        );
        throw new StripeWebhookError(
          `Failed to update newsletter status in Firestore after MailerLite sync for ${customerEmail}`,
          500,
        );
      }
    } catch (error) {
      // Only catch errors from MailerLite specifically
      if (!(error instanceof MailerLiteError)) {
        throw error; // Fail the webhook - this is not a MailerLite API issue
      }

      const errorMessage = error.message;

      // MailerLiteError already contains the classified errorId from classifyMailerLiteError
      const specificErrorId = error.errorId;

      logger.error("Failed to add subscriber to MailerLite", {
        error,
        errorId: specificErrorId,
        retryable: error.retryable,
        uid: userRecord.uid,
        email: customerEmail,
        actionRequired: "Manual newsletter signup needed",
      });

      warning = "Newsletter subscription failed - manual signup needed";

      // Send notification email to newsletter admin (production only)
      if (!process.env["FUNCTIONS_EMULATOR"]) {
        await sendMailerLiteFailureNotification({
          emailService,
          customerEmail,
          customerName,
          userRecord,
          subscriptionStart,
          membershipExpiresAt,
          errorMessage,
          logger,
        });
      }
    }
  } else if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.warn(
      "MAILERLITE_API_KEY not configured - emulator mode, skipping newsletter",
    );
  } else {
    logger.error("CRITICAL: MAILERLITE_API_KEY not configured in production", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_MAILERLITE_NOT_CONFIGURED,
      uid: userRecord.uid,
      email: customerEmail,
      severity: "CRITICAL",
      actionRequired:
        "Configure MAILERLITE_API_KEY in Firebase Functions secrets immediately",
      impact: "Users completing checkout will not be added to newsletter",
    });
    warning = "Newsletter not configured - manual signup required";
  }

  // Step 4: Send welcome email (non-critical - don't fail webhook if this fails)
  let emailSent = false;
  if (isNewUser) {
    try {
      await sendWelcomeEmail({
        email: customerEmail,
        uid: userRecord.uid,
        emailService,
        logger,
      });
      emailSent = true;

      // Update member document with email success status
      await database.collection(MEMBERS_COLLECTION).doc(userRecord.uid).set(
        {
          welcomeEmailStatus: "sent",
          welcomeEmailSentAt: Timestamp.now(),
        },
        { merge: true },
      );

      logger.info("Welcome email sent successfully", {
        uid: userRecord.uid,
        email: customerEmail,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Email failed but account is active", {
        error,
        errorId: ERROR_IDS.STRIPE_WEBHOOK_EMAIL_FAILED,
        uid: userRecord.uid,
        email: customerEmail,
        memberDocCreated: true,
        actionRequired: "Manually resend welcome email",
      });

      warning = warning
        ? `${warning}; Welcome email failed`
        : "Welcome email failed - manual resend needed";

      // Store failure status in member document for recovery
      try {
        await database.collection(MEMBERS_COLLECTION).doc(userRecord.uid).set(
          {
            welcomeEmailStatus: "failed",
            welcomeEmailError: errorMessage,
          },
          { merge: true },
        );
      } catch (firestoreError) {
        logger.error("Failed to update email failure status in Firestore", {
          error: firestoreError,
          uid: userRecord.uid,
          originalEmailError: errorMessage,
          context: "Cascading failure - email failed AND status update failed",
          severity: "CRITICAL",
          actionRequired:
            "Check Firestore permissions and manually record email failure status",
        });
      }

      // Notify admin about the failure (production only)
      if (!process.env["FUNCTIONS_EMULATOR"]) {
        await sendWelcomeEmailFailureNotification({
          emailService,
          customerEmail,
          customerName,
          userRecord,
          subscriptionStart,
          membershipExpiresAt,
          errorMessage,
          logger,
        });
      }
    }

    // Step 5: Notify referrals coordinator about new member (non-critical)
    if (!process.env["FUNCTIONS_EMULATOR"]) {
      await sendReferralCoordinatorNotification({
        emailService,
        customerEmail,
        customerName,
        uid: userRecord.uid,
        logger,
      });
    }
  }

  return {
    userId: userRecord.uid,
    isNewUser,
    emailSent,
    mailerliteSynced,
    ...(warning && { warning }),
  };
}
