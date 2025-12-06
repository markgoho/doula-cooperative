/**
 * Error ID constants for Sentry tracking and error correlation.
 * Use these IDs consistently in error logs to enable tracking error patterns across requests.
 *
 * Naming convention: <module>_<specific_error_condition>
 * Add new error IDs for any error condition that needs tracking/monitoring/debugging.
 */
export const ERROR_IDS = {
  // Stripe webhook errors
  STRIPE_WEBHOOK_MISSING_SECRETS: "stripe_webhook_missing_secrets",
  STRIPE_WEBHOOK_MISSING_SIGNATURE: "stripe_webhook_missing_signature",
  STRIPE_WEBHOOK_INVALID_SIGNATURE: "stripe_webhook_invalid_signature",
  STRIPE_WEBHOOK_MISSING_EMAIL: "stripe_webhook_missing_email",
  STRIPE_WEBHOOK_UNHANDLED_EVENT: "stripe_webhook_unhandled_event",
  STRIPE_WEBHOOK_AUTH_LOOKUP_FAILED: "stripe_webhook_auth_lookup_failed",
  STRIPE_WEBHOOK_USER_CREATE_FAILED: "stripe_webhook_user_create_failed",
  STRIPE_WEBHOOK_MEMBER_DOC_CREATE_FAILED:
    "stripe_webhook_member_doc_create_failed",
  STRIPE_WEBHOOK_MEMBER_DOC_UPDATE_FAILED:
    "stripe_webhook_member_doc_update_failed",
  STRIPE_WEBHOOK_PASSWORD_RESET_LINK_FAILED:
    "stripe_webhook_password_reset_link_failed",
  STRIPE_WEBHOOK_MAILGUN_NOT_CONFIGURED:
    "stripe_webhook_mailgun_not_configured",
  STRIPE_WEBHOOK_MAILGUN_FAILED: "stripe_webhook_mailgun_failed",
  STRIPE_WEBHOOK_EMAIL_FAILED: "stripe_webhook_email_failed",
  STRIPE_WEBHOOK_UNEXPECTED_ERROR: "stripe_webhook_unexpected_error",

  // Legacy member activation errors
  LEGACY_ACTIVATION_INVALID_DATA: "legacy_activation_invalid_data",
  LEGACY_ACTIVATION_FIRESTORE_FAILED: "legacy_activation_firestore_failed",
  LEGACY_ACTIVATION_SYSTEMIC_FAILURE: "legacy_activation_systemic_failure",

  // Mailgun-specific errors
  MAILGUN_AUTH_FAILED: "mailgun_auth_failed",
  MAILGUN_DOMAIN_NOT_CONFIGURED: "mailgun_domain_not_configured",
  MAILGUN_RATE_LIMITED: "mailgun_rate_limited",
  MAILGUN_INVALID_RECIPIENT: "mailgun_invalid_recipient",
  MAILGUN_NETWORK_ERROR: "mailgun_network_error",

  // Admin send invitation errors
  ADMIN_SEND_INVITATION_INVALID_UID: "admin_send_invitation_invalid_uid",
  ADMIN_SEND_INVITATION_MEMBER_NOT_FOUND:
    "admin_send_invitation_member_not_found",
  ADMIN_SEND_INVITATION_NO_SUBSCRIPTION:
    "admin_send_invitation_no_subscription",
  ADMIN_SEND_INVITATION_EMAIL_FAILED: "admin_send_invitation_email_failed",

  // Write profile errors
  WRITE_PROFILE_GITHUB_RATE_LIMIT: "write_profile_github_rate_limit",
  WRITE_PROFILE_GITHUB_NOT_FOUND: "write_profile_github_not_found",
  WRITE_PROFILE_GITHUB_CONFLICT: "write_profile_github_conflict",
  WRITE_PROFILE_GITHUB_GENERIC: "write_profile_github_generic",
  WRITE_PROFILE_METADATA_PARSE_FAILED: "write_profile_metadata_parse_failed",
  WRITE_PROFILE_PROCESSING_ERROR: "write_profile_processing_error",

  // Create profile errors
  CREATE_PROFILE_GITHUB_RATE_LIMIT: "create_profile_github_rate_limit",
  CREATE_PROFILE_GITHUB_CONFLICT: "create_profile_github_conflict",
  CREATE_PROFILE_GITHUB_GENERIC: "create_profile_github_generic",
  CREATE_PROFILE_PROCESSING_ERROR: "create_profile_processing_error",
  CREATE_PROFILE_GITHUB_AUTH_FAILED: "create_profile_github_auth_failed",
  CREATE_PROFILE_FIRESTORE_READ_ERROR: "create_profile_firestore_read_error",
  CREATE_PROFILE_FIRESTORE_UPDATE_ERROR: "create_profile_firestore_update_error",
  CREATE_PROFILE_SERIALIZATION_ERROR: "create_profile_serialization_error",

  // Check slug availability errors
  CHECK_SLUG_FIRESTORE_ERROR: "check_slug_firestore_error",

  // Set profile slug errors
  SET_SLUG_FIRESTORE_READ_ERROR: "set_slug_firestore_read_error",
  SET_SLUG_FIRESTORE_QUERY_ERROR: "set_slug_firestore_query_error",
  SET_SLUG_FIRESTORE_UPDATE_FAILED: "set_slug_firestore_update_failed",
} as const;

export type ErrorId = (typeof ERROR_IDS)[keyof typeof ERROR_IDS];
