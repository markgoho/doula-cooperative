import type { UserRecord } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import {
  ERROR_IDS,
  MARK_EMAIL,
  NEWSLETTER_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../../constants/index.js";
import { StripeWebhookError } from "../../shared-api/errors/stripe-errors.js";
import type {
  EmailServiceInterface,
  EmailMessage,
} from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { escapeHtml } from "../../utils/html-escape.js";
import {
  addNewsletterSubscriber,
  MailerLiteError,
} from "../../utils/mailerlite.js";
import {
  createStripeMemberDocument,
  createStripeMemberUpdate,
} from "../../utils/member-factory.js";
import { calculateExpirationDate } from "../../utils/membership-dates.js";
import type { CheckoutCompletedResult } from "./interface.js";

/**
 * Generate a secure random password for new users.
 */
function generateSecurePassword(): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = 20;
  let password = "";

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  for (const number of array) {
    password += characters.charAt(number % characters.length);
  }

  return password;
}

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

  return `
    <h2>MailerLite Newsletter Signup Failed</h2>
    <p>A new member completed payment but could not be added to the newsletter automatically.</p>

    <h3>Member Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(customerEmail)}</li>
      <li><strong>Name:</strong> ${escapeHtml(customerName) || "Not provided"}</li>
      <li><strong>UID:</strong> ${escapeHtml(uid)}</li>
      <li><strong>Subscription Start:</strong> ${escapeHtml(subscriptionStart.toDate().toISOString())}</li>
      <li><strong>Membership Expires:</strong> ${escapeHtml(membershipExpiresAt.toDate().toISOString())}</li>
    </ul>

    <h3>Error Details:</h3>
    <p>${escapeHtml(errorMessage)}</p>

    <p><strong>Action Required:</strong> Manually add this member to the MailerLite newsletter.</p>
  `;
}

interface OptionsConfig {
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
 * Send notification email when MailerLite subscription fails.
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
}: OptionsConfig): Promise<void> {
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
    bcc: REFERRAL_EMAIL,
    subject: "Welcome to Rochester Doula Cooperative!",
    html: `
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

      <p>If you have any questions, please reach out to us at ${MARK_EMAIL}.</p>

      <p>Welcome aboard!</p>
      <p>The Rochester Doula Cooperative Team</p>
    `,
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

  logger.info(`Processing membership for: ${customerEmail}`);

  let userRecord: UserRecord | undefined;
  let isNewUser = false;

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
        ...(session.customer_details?.name && {
          displayName: session.customer_details.name,
        }),
      });

      logger.info(`Created user: ${userRecord.uid}`);
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
        ...(session.customer_details?.name && {
          name: session.customer_details.name,
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

  // Track non-critical operation results
  let mailerliteSynced = false;
  let warning: string | undefined;

  // Step 3.5: Add to newsletter (non-critical - don't fail webhook if this fails)
  if (mailerliteApiKey) {
    try {
      const customerName = session.customer_details?.name;
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
          customerName: session.customer_details?.name,
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
          context:
            "Cascading failure - email failed AND status update failed",
          severity: "CRITICAL",
          actionRequired:
            "Check Firestore permissions and manually record email failure status",
        });
      }
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
