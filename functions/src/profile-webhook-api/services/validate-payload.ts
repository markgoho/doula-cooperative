import {
  isProfileNotificationType,
  type ValidationResult,
  type WebhookPayload,
} from "./types.js";

/**
 * Validate webhook payload structure and determine if notification should be sent.
 *
 * @param payload - The webhook payload to validate
 * @returns Validation result with reason if invalid
 */
export function validatePayload({
  payload,
}: {
  payload: WebhookPayload;
}): ValidationResult {
  const { notificationType, slug } = payload;

  // Validate required fields
  if (!notificationType || slug === undefined) {
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
  if (!isProfileNotificationType(notificationType)) {
    return {
      isValid: false,
      reason: "not_profile_related",
    };
  }

  return {
    isValid: true,
    payload: {
      notificationType,
      slug,
    },
  };
}
