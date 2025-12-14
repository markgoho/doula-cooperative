import type { ValidationResult } from "./types.js";

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
    commitMessage?: string;
    commitSha?: string;
    slug?: string;
  };
}): ValidationResult {
  const { commitMessage, commitSha, slug } = payload;

  // Validate required fields
  if (!commitMessage || !commitSha || slug === undefined) {
    return {
      isValid: false,
      reason: "invalid_payload",
    };
  }

  // Check if this is a single profile update
  if (!slug || slug === "") {
    return {
      isValid: false,
      reason: "not_single_profile",
    };
  }

  // Check if commit message indicates a profile or image update/deletion (not creation)
  const isProfileUpdate = commitMessage.startsWith("Update profile for ");
  const isImageUpdate = commitMessage.startsWith("Update profile image for ");
  const isImageDeletion = commitMessage.startsWith(
    "Delete all profile images for ",
  );

  if (!isProfileUpdate && !isImageUpdate && !isImageDeletion) {
    return {
      isValid: false,
      reason: "not_profile_related",
    };
  }

  return { isValid: true, reason: undefined };
}
