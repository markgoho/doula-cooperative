import type { Response } from "express";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import type { MailgunMessageData } from "mailgun.js/definitions";
import Stripe from "stripe";
import {
  MEMBERS_COLLECTION,
  PROCESSED_STRIPE_EVENTS_COLLECTION,
} from "../collections/index.js";
import {
  ERROR_IDS,
  MARK_EMAIL,
  NEWSLETTER_EMAIL,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants/index.js";
import { escapeHtml } from "../utils/html-escape.js";
import {
  createStripeMemberDocument,
  createStripeMemberUpdate,
} from "../utils/member-factory.js";
import { addNewsletterSubscriber, MailerLiteError } from "../utils/mailerlite.js";
import { calculateExpirationDate } from "../utils/membership-dates.js";
import { sendEmail } from "../utils/send-email.js";

/**
 * Creates HTML for MailerLite failure notification email
 * @param customerEmail - Email of the customer
 * @param customerName - Name of the customer
 * @param uid - User ID
 * @param subscriptionStart - Subscription start timestamp
 * @param membershipExpiresAt - Membership expiration timestamp
 * @param errorMessage - Error message from MailerLite
 * @returns HTML string for the email
 */
function createMailerLiteFailureEmailHtml(
  customerEmail: string,
  customerName: string | null | undefined,
  uid: string,
  subscriptionStart: Timestamp,
  membershipExpiresAt: Timestamp,
  errorMessage: string,
): string {
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

/**
 * Sends notification email when MailerLite subscription fails
 * @param parameters - Parameters for the notification email
 */
async function sendMailerLiteFailureNotification(parameters: {
  customerEmail: string;
  customerName: string | null | undefined;
  userRecord: UserRecord;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  errorMessage: string;
  mailgunApiKey: string;
}): Promise<void> {
  const {
    customerEmail,
    customerName,
    userRecord,
    subscriptionStart,
    membershipExpiresAt,
    errorMessage,
    mailgunApiKey,
  } = parameters;

  try {
    const notificationEmail: MailgunMessageData = {
      from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
      to: NEWSLETTER_EMAIL,
      subject: "Action Required: Manual Newsletter Signup",
      html: createMailerLiteFailureEmailHtml(
        customerEmail,
        customerName,
        userRecord.uid,
        subscriptionStart,
        membershipExpiresAt,
        errorMessage,
      ),
    };

    await sendEmail(notificationEmail, mailgunApiKey);
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
    // But this is logged as CRITICAL so it will be tracked in Sentry
  }
}

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

async function sendWelcomeEmail(
  email: string,
  uid: string,
  mailgunApiKey: string,
): Promise<void> {
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

  const emailMessage: MailgunMessageData = {
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
      await sendEmail(emailMessage, mailgunApiKey);
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

export async function handler(request: Request, response: Response) {
  const stripeApiKey = process.env["STRIPE_API_KEY"];
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  const mailgunApiKey = process.env["MAILGUN_API_KEY"];
  const mailerliteApiKey = process.env["MAILERLITE_API_KEY"];

  if (!stripeApiKey || !webhookSecret) {
    logger.error("Missing required Stripe secrets", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_MISSING_SECRETS,
      hasApiKey: !!stripeApiKey,
      hasWebhookSecret: !!webhookSecret,
    });
    response.status(500).send("Stripe integration not configured");
    return;
  }

  let stripe: Stripe;
  try {
    stripe = new Stripe(stripeApiKey);
  } catch (error) {
    logger.error("Failed to initialize Stripe client", {
      error,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_MISSING_SECRETS,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    response.status(500).send("Invalid Stripe configuration");
    return;
  }

  const sig = request.headers["stripe-signature"];

  if (!sig) {
    logger.error("Missing stripe-signature header", {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_MISSING_SIGNATURE,
    });
    response.status(400).send("Missing signature");
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(request.rawBody, sig, webhookSecret);
  } catch (error: unknown) {
    logger.error("Webhook signature verification failed", {
      error,
      errorId: ERROR_IDS.STRIPE_WEBHOOK_INVALID_SIGNATURE,
      hasSignature: !!sig,
      signatureLength: sig.length,
    });
    response.status(400).send("Webhook signature verification failed");
    return;
  }

  if (event.type === "checkout.session.completed") {
    // Check for duplicate webhook events (idempotency)
    // Use .create() which atomically fails if document exists, preventing race conditions
    const database = getFirestore();
    const processedEventReference = database
      .collection(PROCESSED_STRIPE_EVENTS_COLLECTION)
      .doc(event.id);

    try {
      await processedEventReference.create({
        eventId: event.id,
        eventType: event.type,
        processedAt: Timestamp.now(),
        received: true,
      });
    } catch (error: unknown) {
      // Check if this is an already-exists error (duplicate webhook)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 6 // Firestore error code 6 is ALREADY_EXISTS
      ) {
        const processedEventDocument = await processedEventReference.get();
        const data = processedEventDocument.data();
        const processedAt = data?.["processedAt"] as Timestamp | undefined;
        logger.info(`Event ${event.id} already processed, skipping`, {
          eventId: event.id,
          eventType: event.type,
          processedAt: processedAt?.toDate().toISOString(),
        });
        response.json({ received: true, duplicate: true });
        return;
      }
      // Re-throw if it's a different error
      throw error;
    }
    const session = event.data.object;

    // Get email from customer_details (customer_email is often null in real webhooks)
    const customerEmail =
      session.customer_details?.email ?? session.customer_email;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!customerEmail) {
      logger.error("No customer email in checkout session", {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_MISSING_EMAIL,
        customerId,
      });
      response.status(400).send("Missing customer email");
      return;
    }

    logger.info(`Processing membership for: ${customerEmail}`);

    const auth = getAuth();

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
        // Expected case - user doesn't exist yet
        isNewUser = true;
        logger.info(
          `User not found, will create new user for: ${customerEmail}`,
        );
      } else {
        // Unexpected error during lookup
        logger.error("Failed to look up user in Firebase Auth", {
          error,
          errorId: ERROR_IDS.STRIPE_WEBHOOK_AUTH_LOOKUP_FAILED,
          customerEmail,
          customerId,
        });
        response.status(500).send("Unable to verify account status");
        return;
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
          errorId: ERROR_IDS.STRIPE_WEBHOOK_USER_CREATE_FAILED,
          customerEmail,
          customerId,
        });
        response.status(500).send("Unable to create account");
        return;
      }
    }

    if (!userRecord) {
      logger.error("User record is undefined after lookup/create", {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_UNEXPECTED_ERROR,
        customerEmail,
      });
      response.status(500).send("Internal server error");
      return;
    }

    // Step 3: Create or update member document
    const subscriptionStart = Timestamp.now();
    const membershipExpiresAt = calculateExpirationDate(subscriptionStart);

    if (isNewUser) {
      // Create new member document using factory function
      // NOTE: There's a potential race condition with createMemberOnUserCreated trigger.
      // If the Auth trigger fires first, it creates a basic document, then this overwrites it.
      // This is acceptable as we want the Stripe data to be authoritative.
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
          errorId: ERROR_IDS.STRIPE_WEBHOOK_MEMBER_DOC_CREATE_FAILED,
          uid: userRecord.uid,
          customerEmail,
          requiresManualIntervention: true,
        });
        response
          .status(500)
          .send(
            "Account created but setup incomplete - support will contact you",
          );
        return;
      }
    } else {
      // Update existing member document using factory function
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
          errorId: ERROR_IDS.STRIPE_WEBHOOK_MEMBER_DOC_UPDATE_FAILED,
          uid: userRecord.uid,
          customerEmail,
        });
        response.status(500).send("Unable to update membership");
        return;
      }
    }

    // Step 3.5: Add to newsletter (non-critical - don't fail webhook if this fails)
    // This is wrapped in try-catch because newsletter subscription failure should not
    // block member account creation. The member's Stripe payment has succeeded and their
    // Firestore record has been created. If MailerLite fails, we send a notification
    // email to newsletter@doulacooperative.com for manual follow-up.
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
        // CRITICAL: This must succeed to keep Firestore and MailerLite in sync
        try {
          await database
            .collection(MEMBERS_COLLECTION)
            .doc(userRecord.uid)
            .set(
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
        } catch (firestoreError) {
          // This is a critical failure - MailerLite and Firestore would be out of sync
          // Throw error to fail the webhook and trigger Stripe retry
          // MailerLite createOrUpdate is idempotent, so retry is safe
          logger.error("CRITICAL: Failed to update member document with newsletter status", {
            error: firestoreError,
            errorId: ERROR_IDS.STRIPE_WEBHOOK_MEMBER_DOC_UPDATE_FAILED,
            uid: userRecord.uid,
            email: customerEmail,
            context: "MailerLite was updated but Firestore sync failed - throwing to trigger webhook retry",
            severity: "CRITICAL",
          });
          throw new Error(
            `Failed to update newsletter status in Firestore after MailerLite sync for ${customerEmail}`,
          );
        }
      } catch (error) {
        // Only catch errors from MailerLite specifically
        // Let all other errors (programmer errors, TypeScript errors) propagate
        if (!(error instanceof MailerLiteError)) {
          // This is not a MailerLite error - it's a programmer error or unexpected failure
          logger.error("Unexpected error in newsletter subscription flow", {
            error,
            errorId: ERROR_IDS.STRIPE_WEBHOOK_UNEXPECTED_ERROR,
            uid: userRecord.uid,
            email: customerEmail,
            context: "This error suggests a bug in the newsletter integration code",
          });
          throw error; // Fail the webhook - this is not a MailerLite API issue
        }

        // This is a MailerLite API error - log and notify but don't fail webhook
        const errorMessage = error.message;

        // Extract specific error ID from error message by parsing the error
        let specificErrorId: string = ERROR_IDS.STRIPE_WEBHOOK_MAILERLITE_FAILED;
        const errorLower = errorMessage.toLowerCase();

        if (
          errorLower.includes("unauthorized") ||
          errorLower.includes("authentication") ||
          errorLower.includes("api key")
        ) {
          specificErrorId = ERROR_IDS.MAILERLITE_AUTH_FAILED;
        } else if (
          errorLower.includes("rate limit") ||
          errorLower.includes("too many requests")
        ) {
          specificErrorId = ERROR_IDS.MAILERLITE_RATE_LIMITED;
        } else if (
          errorLower.includes("invalid") &&
          errorLower.includes("email")
        ) {
          specificErrorId = ERROR_IDS.MAILERLITE_INVALID_EMAIL;
        } else if (
          errorLower.includes("network") ||
          errorLower.includes("timeout") ||
          errorLower.includes("econnrefused") ||
          errorLower.includes("enotfound")
        ) {
          specificErrorId = ERROR_IDS.MAILERLITE_NETWORK_ERROR;
        }

        logger.error("Failed to add subscriber to MailerLite", {
          error,
          errorId: specificErrorId,
          uid: userRecord.uid,
          email: customerEmail,
          actionRequired: "Manual newsletter signup needed",
        });

        // Send notification email to newsletter admin (production only)
        // This alerts the team to manually add the subscriber in MailerLite
        if (!process.env["FUNCTIONS_EMULATOR"] && mailgunApiKey) {
          await sendMailerLiteFailureNotification({
            customerEmail,
            customerName: session.customer_details?.name,
            userRecord,
            subscriptionStart,
            membershipExpiresAt,
            errorMessage,
            mailgunApiKey,
          });
        }
        // Webhook continues - account creation succeeded
      }
    } else if (process.env["FUNCTIONS_EMULATOR"]) {
      logger.warn(
        "MAILERLITE_API_KEY not configured - emulator mode, skipping newsletter",
      );
    } else {
      // Production environment - MailerLite should be configured but isn't
      logger.error("CRITICAL: MAILERLITE_API_KEY not configured in production", {
        errorId: ERROR_IDS.STRIPE_WEBHOOK_MAILERLITE_NOT_CONFIGURED,
        uid: userRecord.uid,
        email: customerEmail,
        severity: "CRITICAL",
        actionRequired:
          "Configure MAILERLITE_API_KEY in Firebase Functions secrets immediately",
        impact: "Users completing checkout will not be added to newsletter",
      });

      // Send immediate notification to admin
      if (mailgunApiKey) {
        try {
          const configAlert: MailgunMessageData = {
            from: `Doula Cooperative Alerts <${NO_REPLY_EMAIL}>`,
            to: NEWSLETTER_EMAIL,
            subject: "CRITICAL: MailerLite Not Configured",
            html: `
              <h2>CRITICAL: MailerLite API Key Not Configured</h2>
              <p>A member just completed checkout but MailerLite is not configured in production.</p>
              <h3>Member Details:</h3>
              <ul>
                <li><strong>Email:</strong> ${escapeHtml(customerEmail)}</li>
                <li><strong>UID:</strong> ${escapeHtml(userRecord.uid)}</li>
                <li><strong>Time:</strong> ${escapeHtml(new Date().toISOString())}</li>
              </ul>
              <p><strong>Action Required:</strong> Configure MAILERLITE_API_KEY in Firebase Functions secrets immediately and manually add all affected members to the newsletter.</p>
            `,
          };
          await sendEmail(configAlert, mailgunApiKey);
        } catch (emailError) {
          logger.error("Failed to send MailerLite configuration alert", {
            error: emailError,
            errorId: ERROR_IDS.STRIPE_WEBHOOK_MAILERLITE_NOTIFICATION_FAILED,
            uid: userRecord.uid,
          });
        }
      }
    }

    // Step 4: Send welcome email (non-critical - don't fail webhook if this fails)
    let emailSent = false;
    if (isNewUser) {
      if (mailgunApiKey) {
        try {
          await sendWelcomeEmail(customerEmail, userRecord.uid, mailgunApiKey);
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
          // Email failure should not fail the entire webhook
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

          // Store failure status in member document for recovery
          try {
            await database
              .collection(MEMBERS_COLLECTION)
              .doc(userRecord.uid)
              .set(
                {
                  welcomeEmailStatus: "failed",
                  welcomeEmailError: errorMessage,
                },
                { merge: true },
              );
          } catch (firestoreError) {
            // Log but don't fail if we can't update the email status
            logger.error("Failed to update email failure status in Firestore", {
              error: firestoreError,
              uid: userRecord.uid,
            });
          }
          // Continue - account was created successfully, email can be resent manually
        }
      } else if (process.env["FUNCTIONS_EMULATOR"]) {
        logger.warn(
          "MAILGUN_API_KEY not configured - emulator mode, skipping email",
        );
      } else {
        logger.error("MAILGUN_API_KEY not configured in production", {
          errorId: ERROR_IDS.STRIPE_WEBHOOK_MAILGUN_NOT_CONFIGURED,
          uid: userRecord.uid,
          email: customerEmail,
        });

        // Store pending status for manual follow-up
        try {
          await database.collection(MEMBERS_COLLECTION).doc(userRecord.uid).set(
            {
              welcomeEmailStatus: "pending",
              welcomeEmailError: "MAILGUN_API_KEY not configured",
            },
            { merge: true },
          );
        } catch (firestoreError) {
          logger.error("Failed to update pending email status", {
            error: firestoreError,
            uid: userRecord.uid,
          });
        }
      }
    }

    response.json({ received: true, userId: userRecord.uid, emailSent });
  } else {
    logger.warn(`Unhandled event type: ${event.type}`, {
      errorId: ERROR_IDS.STRIPE_WEBHOOK_UNHANDLED_EVENT,
      eventType: event.type,
    });
    response.json({ received: true });
  }
}
