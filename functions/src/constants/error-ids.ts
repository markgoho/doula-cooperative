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

  // MailerLite newsletter errors
  MAILERLITE_AUTH_FAILED: "mailerlite_auth_failed",
  MAILERLITE_RATE_LIMITED: "mailerlite_rate_limited",
  MAILERLITE_INVALID_EMAIL: "mailerlite_invalid_email",
  MAILERLITE_NETWORK_ERROR: "mailerlite_network_error",
  MAILERLITE_GENERIC_ERROR: "mailerlite_generic_error",
  STRIPE_WEBHOOK_MAILERLITE_NOT_CONFIGURED:
    "stripe_webhook_mailerlite_not_configured",
  STRIPE_WEBHOOK_MAILERLITE_FAILED: "stripe_webhook_mailerlite_failed",
  STRIPE_WEBHOOK_MAILERLITE_NOTIFICATION_FAILED:
    "stripe_webhook_mailerlite_notification_failed",

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

  // Claim profile errors
  CLAIM_PROFILE_FIRESTORE_WRITE_ERROR: "claim_profile_firestore_write_error",
  CLAIM_PROFILE_AUTH_UPDATE_FAILED: "claim_profile_auth_update_failed",
  CLAIM_PROFILE_IMPORT_DELETE_FAILED: "claim_profile_import_delete_failed",
  CLAIM_PROFILE_EXPIRATION_CALC_ERROR: "claim_profile_expiration_calc_error",
  CLAIM_PROFILE_MAILERLITE_FAILED: "claim_profile_mailerlite_failed",
  CLAIM_PROFILE_NOTIFICATION_FAILED: "claim_profile_notification_failed",

  // Newsletter preference errors
  UPDATE_NEWSLETTER_PREF_FIRESTORE_READ_ERROR:
    "update_newsletter_pref_firestore_read_error",
  UPDATE_NEWSLETTER_PREF_FIRESTORE_UPDATE_ERROR:
    "update_newsletter_pref_firestore_update_error",
  UPDATE_NEWSLETTER_PREF_MAILERLITE_FAILED:
    "update_newsletter_pref_mailerlite_failed",
  UPDATE_NEWSLETTER_PREF_NOTIFICATION_FAILED:
    "update_newsletter_pref_notification_failed",
  UPDATE_NEWSLETTER_PREF_MISSING_SUBSCRIPTION_DATES:
    "update_newsletter_pref_missing_subscription_dates",

  // Profile deployment webhook errors
  PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET:
    "profile_deploy_webhook_invalid_secret",
  PROFILE_DEPLOY_WEBHOOK_MEMBER_NOT_FOUND:
    "profile_deploy_webhook_member_not_found",
  PROFILE_DEPLOY_WEBHOOK_EMAIL_FAILED: "profile_deploy_webhook_email_failed",

  // Upload profile image errors
  UPLOAD_PROFILE_IMAGE_INVALID_DATA: "upload_profile_image_invalid_data",
  UPLOAD_PROFILE_IMAGE_TOO_LARGE: "upload_profile_image_too_large",
  UPLOAD_PROFILE_IMAGE_PROCESSING_FAILED:
    "upload_profile_image_processing_failed",
  UPLOAD_PROFILE_IMAGE_AVIF_GENERATION_FAILED:
    "upload_profile_image_avif_generation_failed",
  UPLOAD_PROFILE_IMAGE_GITHUB_RATE_LIMIT:
    "upload_profile_image_github_rate_limit",
  UPLOAD_PROFILE_IMAGE_GITHUB_FAILED: "upload_profile_image_github_failed",
  UPLOAD_PROFILE_IMAGE_BATCH_OPERATION_FAILED:
    "upload_profile_image_batch_operation_failed",
  UPLOAD_PROFILE_IMAGE_FILE_CHECK_FAILED:
    "upload_profile_image_file_check_failed",
  UPLOAD_PROFILE_IMAGE_CLEANUP_FAILED:
    "upload_profile_image_cleanup_failed",

  // Delete profile image errors
  DELETE_PROFILE_IMAGE_FIRESTORE_READ_ERROR:
    "delete_profile_image_firestore_read_error",
  DELETE_PROFILE_IMAGE_GITHUB_RATE_LIMIT:
    "delete_profile_image_github_rate_limit",
  DELETE_PROFILE_IMAGE_GITHUB_FAILED: "delete_profile_image_github_failed",

  // Elysia API errors
  API_HANDLER_FAILED: "api_handler_failed",
  API_ADAPTER_CONVERSION_FAILED: "api_adapter_conversion_failed",
  API_ADAPTER_MISSING_HOST: "api_adapter_missing_host",
  API_ADAPTER_RESPONSE_FAILED: "api_adapter_response_failed",
  API_MEMBER_FETCH_FAILED: "api_member_fetch_failed",
  API_MEMBER_INVALID_DATA: "api_member_invalid_data",
  API_MEMBER_MISSING_FIELDS: "api_member_missing_fields",
  API_AUTH_TOKEN_EXPIRED: "api_auth_token_expired",
  API_AUTH_TOKEN_REVOKED: "api_auth_token_revoked",
  API_AUTH_TOKEN_MALFORMED: "api_auth_token_malformed",
  API_AUTH_TOKEN_WRONG_PROJECT: "api_auth_token_wrong_project",
  API_AUTH_VERIFICATION_FAILED: "api_auth_verification_failed",
  API_HEADERS_ALREADY_SENT: "api_headers_already_sent",

  // Admin member management operations
  API_ADMIN_LIST_MEMBERS_FAILED: "api_admin_list_members_failed",
  API_ADMIN_UPDATE_MEMBER_FAILED: "api_admin_update_member_failed",
  API_ADMIN_ACTIVATE_MEMBERSHIP_FAILED: "api_admin_activate_membership_failed",
  API_ADMIN_DEACTIVATE_MEMBERSHIP_FAILED:
    "api_admin_deactivate_membership_failed",
  API_ADMIN_EXTEND_MEMBERSHIP_FAILED: "api_admin_extend_membership_failed",
  API_ADMIN_DELETE_USER_FAILED: "api_admin_delete_user_failed",

  // Specific admin error scenarios
  API_ADMIN_PROTECTED_FIELD_UPDATE: "api_admin_protected_field_update",
  API_ADMIN_SELF_DELETE_ATTEMPT: "api_admin_self_delete_attempt",
  API_ADMIN_DELETE_ADMIN_ATTEMPT: "api_admin_delete_admin_attempt",
} as const;

export type ErrorId = (typeof ERROR_IDS)[keyof typeof ERROR_IDS];
