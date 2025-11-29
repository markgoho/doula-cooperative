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
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants/index.js";
import {
  createStripeMemberDocument,
  createStripeMemberUpdate,
} from "../utils/member-factory.js";
import { calculateExpirationDate } from "../utils/membership-dates.js";
import { sendEmail } from "../utils/send-email.js";

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
