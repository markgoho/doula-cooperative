import type {
  CreateOrUpdateSubscriberParams,
  SubscriberInterface,
} from "@mailerlite/mailerlite-nodejs";
import * as MailerLiteModule from "@mailerlite/mailerlite-nodejs";
import type { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { ERROR_IDS, type ErrorId } from "../../constants/index.js";

// MailerLite SDK uses CommonJS exports, need to access .default
interface MailerLiteClient {
  subscribers: SubscriberInterface;
}

// Type assertion for CommonJS default export
const MailerLite = (
  MailerLiteModule as unknown as {
    default: new (config: { api_key: string }) => MailerLiteClient;
  }
).default;

/**
 * Custom error class for MailerLite API failures
 * Use this instead of generic Error to enable type-safe error handling
 */
export class MailerLiteError extends Error {
  constructor(
    message: string,
    public readonly email: string,
    public readonly errorId: ErrorId,
    public readonly retryable: boolean,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "MailerLiteError";
  }
}

/**
 * Classifies MailerLite errors into specific error types
 * @param error - The error to classify
 * @returns Object containing errorId and retryable flag
 */
function classifyMailerLiteError(error: unknown): {
  errorId: ErrorId;
  retryable: boolean;
} {
  if (!(error instanceof Error)) {
    return {
      errorId: ERROR_IDS.MAILERLITE_GENERIC_ERROR,
      retryable: false,
    };
  }

  const errorMessage = error.message.toLowerCase();

  // Check for invalid email specifically (requires both keywords)
  if (errorMessage.includes("invalid") && errorMessage.includes("email")) {
    return {
      errorId: ERROR_IDS.MAILERLITE_INVALID_EMAIL,
      retryable: false,
    };
  }

  // Map error patterns to error types
  const errorPatterns: {
    patterns: string[];
    errorId: ErrorId;
    retryable: boolean;
  }[] = [
    {
      patterns: ["unauthorized", "forbidden", "authentication", "api key"],
      errorId: ERROR_IDS.MAILERLITE_AUTH_FAILED,
      retryable: false,
    },
    {
      patterns: ["rate limit", "too many requests"],
      errorId: ERROR_IDS.MAILERLITE_RATE_LIMITED,
      retryable: true,
    },
    {
      patterns: ["timeout", "network", "econnrefused", "enotfound"],
      errorId: ERROR_IDS.MAILERLITE_NETWORK_ERROR,
      retryable: true,
    },
  ];

  // Check other patterns
  for (const { patterns, errorId, retryable } of errorPatterns) {
    if (patterns.some(pattern => errorMessage.includes(pattern))) {
      return { errorId, retryable };
    }
  }

  return {
    errorId: ERROR_IDS.MAILERLITE_GENERIC_ERROR,
    retryable: false,
  };
}

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
  // Skip actual API calls in emulator mode to prevent test pollution
  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping MailerLite API call", {
      email,
      hasName: !!name,
      hasGroupId: !!groupId,
      subscriptionStart: formatDateForMailerLite(subscriptionStart),
      membershipExpires: formatDateForMailerLite(membershipExpiresAt),
    });
    return;
  }

  try {
    const mailerlite = new MailerLite({
      api_key: apiKey,
    });

    // Format dates for MailerLite
    const formattedSubscriptionStart =
      formatDateForMailerLite(subscriptionStart);
    const formattedMembershipExpires =
      formatDateForMailerLite(membershipExpiresAt);

    // Build subscriber parameters with optional fields
    const fields: Record<string, string> = {
      subscription_start: formattedSubscriptionStart,
      membership_expires: formattedMembershipExpires,
    };

    // Only add name if provided
    if (name) {
      fields["name"] = name;
    }

    const subscriberParameters: CreateOrUpdateSubscriberParams = {
      email,
      fields,
      status: "active",
      subscribed_at: formatDateForMailerLite(subscriptionStart),
    };

    // Only add groups if groupId is provided
    if (groupId) {
      subscriberParameters.groups = [groupId];
    }

    await mailerlite.subscribers.createOrUpdate(subscriberParameters);

    logger.info("Successfully added subscriber to MailerLite", {
      email,
      hasGroupId: !!groupId,
    });
  } catch (error) {
    const { errorId, retryable } = classifyMailerLiteError(error);

    // Format dates for logging
    const formattedSubscriptionStart =
      formatDateForMailerLite(subscriptionStart);
    const formattedMembershipExpires =
      formatDateForMailerLite(membershipExpiresAt);

    logger.error("MailerLite API call failed", {
      error,
      errorId,
      retryable,
      email,
      groupId: groupId ?? "none",
      hasName: !!name,
      subscriberParameters: {
        email,
        hasName: !!name,
        subscriptionStart: formattedSubscriptionStart,
        membershipExpires: formattedMembershipExpires,
        groupId: groupId ?? "none",
      },
      actionRequired: retryable
        ? "MailerLite request may succeed if retried"
        : "Manual intervention required - check MailerLite configuration",
    });

    throw new MailerLiteError(
      `Failed to add subscriber to MailerLite for ${email}: ${error instanceof Error ? error.message : "Unknown error"}`,
      email,
      errorId,
      retryable,
      error,
    );
  }
}

/**
 * Removes a newsletter subscriber from MailerLite by marking them as "unsubscribed".
 * This preserves subscriber history while preventing future emails.
 * @param params - Subscriber email and API key
 * @throws Error if MailerLite API call fails
 */
export async function removeNewsletterSubscriber({
  email,
  apiKey,
}: {
  email: string;
  apiKey: string;
}): Promise<void> {
  // Skip actual API calls in emulator mode to prevent test pollution
  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping MailerLite API call", {
      email,
      action: "unsubscribe",
    });
    return;
  }

  try {
    const mailerlite = new MailerLite({
      api_key: apiKey,
    });

    // Update subscriber status to "unsubscribed" to preserve history
    await mailerlite.subscribers.createOrUpdate({
      email,
      status: "unsubscribed",
    });

    logger.info(
      "Successfully marked subscriber as unsubscribed in MailerLite",
      {
        email,
      },
    );
  } catch (error) {
    const { errorId, retryable } = classifyMailerLiteError(error);

    logger.error("MailerLite API call failed while removing subscriber", {
      error,
      errorId,
      retryable,
      email,
      actionRequired: retryable
        ? "MailerLite request may succeed if retried"
        : "Manual intervention required - check MailerLite configuration",
    });

    throw new MailerLiteError(
      `Failed to remove subscriber from MailerLite for ${email}: ${error instanceof Error ? error.message : "Unknown error"}`,
      email,
      errorId,
      retryable,
      error,
    );
  }
}
