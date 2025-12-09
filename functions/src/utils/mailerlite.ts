import type { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type {
  CreateOrUpdateSubscriberParams,
  SubscriberInterface,
} from "@mailerlite/mailerlite-nodejs";
import * as MailerLiteModule from "@mailerlite/mailerlite-nodejs";
import { ERROR_IDS, type ErrorId } from "../constants/index.js";

// MailerLite SDK uses CommonJS exports, need to access .default
interface MailerLiteClient {
  subscribers: SubscriberInterface;
}

// Type assertion for CommonJS default export
const MailerLite = (MailerLiteModule as unknown as { default: new (config: { api_key: string }) => MailerLiteClient }).default;

/**
 * Formats a Firebase Timestamp to MailerLite's required date format
 * @param timestamp - Firebase Timestamp to format
 * @returns Date string in format "yyyy-MM-dd HH:mm:ss"
 */
function formatDateForMailerLite(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Adds or updates a newsletter subscriber in MailerLite
 * @param params - Subscriber information
 * @throws Error if MailerLite API call fails
 */
export async function addNewsletterSubscriber({
  email,
  name,
  subscriptionStart,
  membershipExpiresAt,
  groupId,
  apiKey,
}: {
  email: string;
  name?: string;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  groupId?: string;
  apiKey: string;
}): Promise<void> {
  try {
    const mailerlite = new MailerLite({
      api_key: apiKey,
    });

    // Format dates for MailerLite
    const formattedSubscriptionStart = formatDateForMailerLite(subscriptionStart);
    const formattedMembershipExpires =
      formatDateForMailerLite(membershipExpiresAt);

    // Build subscriber parameters
    const subscriberParameters: CreateOrUpdateSubscriberParams = {
      email,
      fields: {
        ...(name && { name }),
        subscription_start: formattedSubscriptionStart,
        membership_expires: formattedMembershipExpires,
      },
      ...(groupId && { groups: [groupId] }),
      status: "active",
      subscribed_at: formatDateForMailerLite(subscriptionStart),
    };

    await mailerlite.subscribers.createOrUpdate(subscriberParameters);

    logger.info("Successfully added subscriber to MailerLite", {
      email,
      hasGroupId: !!groupId,
    });
  } catch (error) {
    // Parse MailerLite-specific errors
    let specificErrorId: ErrorId = ERROR_IDS.MAILERLITE_GENERIC_ERROR;
    let retryable = false;

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("forbidden") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("api key")
      ) {
        specificErrorId = ERROR_IDS.MAILERLITE_AUTH_FAILED;
      } else if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("too many requests")
      ) {
        specificErrorId = ERROR_IDS.MAILERLITE_RATE_LIMITED;
        retryable = true;
      } else if (
        errorMessage.includes("invalid") &&
        errorMessage.includes("email")
      ) {
        specificErrorId = ERROR_IDS.MAILERLITE_INVALID_EMAIL;
      } else if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("network") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("enotfound")
      ) {
        specificErrorId = ERROR_IDS.MAILERLITE_NETWORK_ERROR;
        retryable = true;
      }
    }

    logger.error("MailerLite API call failed", {
      error,
      errorId: specificErrorId,
      retryable,
      email,
    });

    throw new Error(
      `Failed to add subscriber to MailerLite for ${email}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
