import type { ProfileNotificationType, ValidationResult } from "./types.js";

const VALID_NOTIFICATION_TYPES = new Set<ProfileNotificationType>([
  "publish",
  "update",
  "image-update",
  "image-delete",
]);

/**
 * Validate webhook payload structure and determine if notification should be sent.
 *
 * @param payload - The webhook payload to validate
 * @returns Validation result with reason if invalid
 */
export function validatePayload({
  payload,
}: {
  payload: {
    notificationType?: string;
    commitSha?: string;
    slug?: string;
  };
}): ValidationResult {
  const { notificationType, commitSha, slug } = payload;

  // Validate required fields
  if (!notificationType || !commitSha || slug === undefined) {
    return {
      isValid: false,
      reason: "invalid_payload",
    };
  }

  // Check if this is a single profile update
  if (slug === "") {
    return {
      isValid: false,
      reason: "not_single_profile",
    };
  }

  // Check if notification type indicates a supported profile event
  if (!VALID_NOTIFICATION_TYPES.has(notificationType as ProfileNotificationType)) {
    return {
      isValid: false,
      reason: "not_profile_related",
    };
  }

  return { isValid: true, reason: undefined };
}
