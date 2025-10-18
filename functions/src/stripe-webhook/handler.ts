import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { Response } from "express";
import { logger } from "firebase-functions/v2";
import type { Request } from "firebase-functions/v2/https";
import type { MailgunMessageData } from "mailgun.js/definitions";
import Stripe from "stripe";
import {
  MEMBERS_COLLECTION,
  NO_REPLY_EMAIL,
  REFERRAL_EMAIL,
} from "../constants";
import { MemberDocument } from "../types/member-document";
import { sendEmail } from "../utils/send-email";

function calculateExpirationDate(subscriptionStart: Timestamp): Timestamp {
  const startDate = subscriptionStart.toDate();
  const monthIndex = startDate.getMonth(); // 0-11

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let expirationYear = currentYear;

  // If the renewal month has already passed this year, or we are in the renewal month,
  // the next renewal is next year.
  if (
    currentMonth > monthIndex ||
    (currentMonth === monthIndex && now.getDate() > 1)
  ) {
    expirationYear += 1;
  }

  // Set the expiration to the last day of the subscription month in the expiration year.
  const expirationDate = new Date(expirationYear, monthIndex + 1, 0);
  return Timestamp.fromDate(expirationDate);
}

function generateSecurePassword(): string {
  // Generate a secure random password (20 characters)
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = 20;
  let password = "";

  // Use crypto for secure random generation
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

  // Generate password reset link
  const resetLink = await auth.generatePasswordResetLink(email, {
    url: "https://members.doulacooperative.com/membership",
  });

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

      <p>This link will expire in 24 hours. If you need a new link, you can request one from the sign-in page.</p>

      <p>Once you've set your password, you'll be able to:</p>
      <ul>
        <li>Access member resources</li>
        <li>Connect with other doulas</li>
        <li>Manage your profile</li>
        <li>Stay updated on cooperative events</li>
      </ul>

      <p>If you have any questions, please reach out to us at ${REFERRAL_EMAIL}.</p>

      <p>Welcome aboard!</p>
      <p>The Rochester Doula Cooperative Team</p>
    `,
  };

  if (process.env.FUNCTIONS_EMULATOR) {
    logger.info("Emulator detected, skipping email dispatch.");
    logger.info(`Would have sent welcome email to: ${email}`);
    logger.info(`Password reset link: ${resetLink}`);
  } else {
    await sendEmail(emailMessage, mailgunApiKey);
    logger.info(`Welcome email sent to: ${email}`);
  }
}

export async function handler(request: Request, response: Response) {
  const stripeApiKey = process.env.STRIPE_API_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const mailgunApiKey = process.env.MAILGUN_API_KEY;

  if (!stripeApiKey || !webhookSecret) {
    logger.error("Missing required Stripe secrets");
    response.status(500).send("Server configuration error");
    return;
  }

  const stripe = new Stripe(stripeApiKey);
  const sig = request.headers["stripe-signature"];

  if (!sig) {
    logger.error("Missing stripe-signature header");
    response.status(400).send("Missing signature");
    return;
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      request.rawBody,
      sig,
      webhookSecret,
    );
  } catch (error: unknown) {
    logger.error("Webhook signature verification failed:", error);
    response.status(400).send("Webhook signature verification failed");
    return;
  }

  // Handle checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const customerEmail = session.customer_email;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!customerEmail) {
      logger.error("No customer email in checkout session");
      response.status(400).send("Missing customer email");
      return;
    }

    logger.info(`Processing membership for: ${customerEmail}`);

    const auth = getAuth();
    const database = getFirestore();

    try {
      // Check if user already exists
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(customerEmail);
        logger.info(`User already exists: ${customerEmail} (${userRecord.uid})`);

        // Update existing member document with Stripe data
        const memberDocumentReference = database
          .collection(MEMBERS_COLLECTION)
          .doc(userRecord.uid);

        const subscriptionStart = Timestamp.now();
        const membershipExpiresAt = calculateExpirationDate(subscriptionStart);

        const memberUpdate: Partial<MemberDocument> = {
          membershipActive: true,
          subscriptionStart,
          membershipExpiresAt,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
        };

        await memberDocumentReference.set(memberUpdate, { merge: true });
        logger.info(`Updated existing member document for: ${customerEmail}`);
      } catch {
        // User doesn't exist, create new user
        logger.info(`Creating new user for: ${customerEmail}`);

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

        // Create member document
        const subscriptionStart = Timestamp.now();
        const membershipExpiresAt = calculateExpirationDate(subscriptionStart);

        const memberDocument: MemberDocument = {
          uid: userRecord.uid,
          email: customerEmail,
          createdAt: subscriptionStart,
          membershipActive: true,
          subscriptionStart,
          membershipExpiresAt,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
          ...(session.customer_details?.name && {
            name: session.customer_details.name,
          }),
        };

        await database
          .collection(MEMBERS_COLLECTION)
          .doc(userRecord.uid)
          .set(memberDocument);

        logger.info(`Created member document for: ${customerEmail}`);

        // Send welcome email with password reset link
        if (mailgunApiKey) {
          await sendWelcomeEmail(customerEmail, userRecord.uid, mailgunApiKey);
        } else {
          logger.warn("MAILGUN_API_KEY not configured, skipping welcome email");
        }
      }

      response.json({ received: true, userId: userRecord.uid });
    } catch (error) {
      logger.error("Error processing checkout session:", error);
      response.status(500).send("Internal server error");
    }
  } else {
    // Unexpected event type
    logger.warn(`Unhandled event type: ${event.type}`);
    response.json({ received: true });
  }
}
