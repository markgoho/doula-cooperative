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
  STRIPE_WEBHOOK_WELCOME_EMAIL_NOTIFICATION_FAILED:
    "stripe_webhook_welcome_email_notification_failed",
  STRIPE_WEBHOOK_REFERRAL_NOTIFICATION_FAILED:
    "stripe_webhook_referral_notification_failed",
  STRIPE_WEBHOOK_NEW_MEMBER_ADMIN_NOTIFICATION_FAILED:
    "stripe_webhook_new_member_admin_notification_failed",
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

  // Write profile errors
  WRITE_PROFILE_METADATA_PARSE_FAILED: "write_profile_metadata_parse_failed",
  WRITE_PROFILE_PROCESSING_ERROR: "write_profile_processing_error",

  // Create profile errors
  CREATE_PROFILE_PROCESSING_ERROR: "create_profile_processing_error",
  CREATE_PROFILE_FIRESTORE_READ_ERROR: "create_profile_firestore_read_error",
  CREATE_PROFILE_FIRESTORE_UPDATE_ERROR:
    "create_profile_firestore_update_error",
  CREATE_PROFILE_SERIALIZATION_ERROR: "create_profile_serialization_error",
  CREATE_PROFILE_NOTIFICATION_FAILED: "create_profile_notification_failed",

  // Check slug availability errors
  CHECK_SLUG_FIRESTORE_ERROR: "check_slug_firestore_error",

  // Set profile slug errors
  SET_SLUG_FIRESTORE_READ_ERROR: "set_slug_firestore_read_error",
  SET_SLUG_FIRESTORE_QUERY_ERROR: "set_slug_firestore_query_error",
  SET_SLUG_FIRESTORE_UPDATE_FAILED: "set_slug_firestore_update_failed",

  // Claim profile errors
  CLAIM_PROFILE_FAILED: "claim_profile_failed",
  CLAIM_PROFILE_NO_DATA: "claim_profile_no_data",
  CLAIM_PROFILE_INVALID_DATA: "claim_profile_invalid_data",
  CLAIM_PROFILE_FIRESTORE_WRITE_ERROR: "claim_profile_firestore_write_error",
  CLAIM_PROFILE_AUTH_UPDATE_FAILED: "claim_profile_auth_update_failed",
  CLAIM_PROFILE_IMPORT_DELETE_FAILED: "claim_profile_import_delete_failed",
  CLAIM_PROFILE_EXPIRATION_CALC_ERROR: "claim_profile_expiration_calc_error",
  CLAIM_PROFILE_MAILERLITE_FAILED: "claim_profile_mailerlite_failed",
  CLAIM_PROFILE_NOTIFICATION_FAILED: "claim_profile_notification_failed",
  CLAIM_PROFILE_EMAIL_SERVICE_FAILED: "claim_profile_email_service_failed",

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
  UPDATE_NEWSLETTER_PREF_MISSING_API_KEY:
    "update_newsletter_pref_missing_api_key",
  UPDATE_NEWSLETTER_PREF_ROUTE_FAILED: "update_newsletter_pref_route_failed",
  UPDATE_NEWSLETTER_PREF_MEMBER_NOT_FOUND:
    "update_newsletter_pref_member_not_found",

  // Profile deployment webhook errors
  PROFILE_DEPLOY_WEBHOOK_INVALID_SECRET:
    "profile_deploy_webhook_invalid_secret",
  PROFILE_DEPLOY_WEBHOOK_MEMBER_NOT_FOUND:
    "profile_deploy_webhook_member_not_found",
  PROFILE_DEPLOY_WEBHOOK_MEMBER_LOOKUP_FAILED:
    "profile_deploy_webhook_member_lookup_failed",
  PROFILE_DEPLOY_WEBHOOK_EMAIL_FAILED: "profile_deploy_webhook_email_failed",
  PROFILE_DEPLOY_WEBHOOK_PROCESSING_FAILED:
    "profile_deploy_webhook_processing_failed",

  // reCAPTCHA verification errors
  RECAPTCHA_VERIFICATION_FAILED: "recaptcha_verification_failed",
  RECAPTCHA_SCORE_TOO_LOW: "recaptcha_score_too_low",
  RECAPTCHA_SECRET_KEY_NOT_CONFIGURED: "recaptcha_secret_key_not_configured",
  RECAPTCHA_API_ERROR: "recaptcha_api_error",
  RECAPTCHA_NETWORK_ERROR: "recaptcha_network_error",

  // Form processing errors
  CONTACT_FORM_PROCESSING_FAILED: "contact_form_processing_failed",
  CONTACT_FORM_FIRESTORE_WRITE_FAILED: "contact_form_firestore_write_failed",
  CONTACT_FORM_NETWORK_ERROR: "contact_form_network_error",
  CONTACT_FORM_QUOTA_EXCEEDED: "contact_form_quota_exceeded",
  DOULA_MATCH_FORM_PROCESSING_FAILED: "doula_match_form_processing_failed",
  DOULA_MATCH_FORM_FIRESTORE_WRITE_FAILED:
    "doula_match_form_firestore_write_failed",

  // Upload profile image errors
  UPLOAD_PROFILE_IMAGE_FAILED: "upload_profile_image_failed",
  UPLOAD_PROFILE_IMAGE_INVALID_DATA: "upload_profile_image_invalid_data",
  UPLOAD_PROFILE_IMAGE_TOO_LARGE: "upload_profile_image_too_large",
  UPLOAD_PROFILE_IMAGE_PROCESSING_FAILED:
    "upload_profile_image_processing_failed",
  UPLOAD_PROFILE_IMAGE_AVIF_GENERATION_FAILED:
    "upload_profile_image_avif_generation_failed",
  UPLOAD_PROFILE_IMAGE_BATCH_OPERATION_FAILED:
    "upload_profile_image_batch_operation_failed",
  UPLOAD_PROFILE_IMAGE_FILE_CHECK_FAILED:
    "upload_profile_image_file_check_failed",
  UPLOAD_PROFILE_IMAGE_CLEANUP_FAILED: "upload_profile_image_cleanup_failed",

  // ImageKit auth errors
  IMAGEKIT_AUTH_FAILED: "imagekit_auth_failed",

  // Delete profile image errors
  DELETE_PROFILE_IMAGE_FAILED: "delete_profile_image_failed",
  DELETE_PROFILE_IMAGE_FIRESTORE_READ_ERROR:
    "delete_profile_image_firestore_read_error",

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
  API_ADMIN_GET_MEMBER_FAILED: "api_admin_get_member_failed",
  API_ADMIN_LIST_MEMBERS_FAILED: "api_admin_list_members_failed",
  API_ADMIN_UPDATE_MEMBER_FAILED: "api_admin_update_member_failed",
  API_ADMIN_ACTIVATE_MEMBERSHIP_FAILED: "api_admin_activate_membership_failed",
  API_ADMIN_DEACTIVATE_MEMBERSHIP_FAILED:
    "api_admin_deactivate_membership_failed",
  API_ADMIN_CANCEL_MEMBERSHIP_FAILED: "api_admin_cancel_membership_failed",
  API_MEMBER_CANCEL_MEMBERSHIP_FAILED: "api_member_cancel_membership_failed",
  API_ADMIN_CANCEL_STRIPE_FAILED: "api_admin_cancel_stripe_failed",
  API_ADMIN_EXTEND_MEMBERSHIP_FAILED: "api_admin_extend_membership_failed",
  API_ADMIN_LINK_PROFILE_IMPORT_DELETE_FAILED:
    "api_admin_link_profile_import_delete_failed",

  // Admin match request management operations
  API_ADMIN_LIST_MATCH_REQUESTS_FAILED: "api_admin_list_match_requests_failed",
  API_ADMIN_GET_MATCH_REQUEST_FAILED: "api_admin_get_match_request_failed",
  API_ADMIN_UPDATE_MATCH_REQUEST_FAILED:
    "api_admin_update_match_request_failed",
  API_MATCH_REQUEST_NOT_FOUND: "api_match_request_not_found",

  // Admin message management operations
  API_ADMIN_LIST_MESSAGES_FAILED: "api_admin_list_messages_failed",
  API_ADMIN_GET_MESSAGE_FAILED: "api_admin_get_message_failed",
  API_ADMIN_UPDATE_MESSAGE_FAILED: "api_admin_update_message_failed",
  API_MESSAGE_NOT_FOUND: "api_message_not_found",

  // Admin unclaimed profile management operations
  API_ADMIN_LIST_UNCLAIMED_PROFILES_FAILED:
    "api_admin_list_unclaimed_profiles_failed",
  API_ADMIN_GET_UNCLAIMED_PROFILE_FAILED:
    "api_admin_get_unclaimed_profile_failed",
  API_ADMIN_DELETE_UNCLAIMED_PROFILE_FAILED:
    "api_admin_delete_unclaimed_profile_failed",
  API_ADMIN_DELETE_UNCLAIMED_PROFILE_MAILERLITE_FAILED:
    "api_admin_delete_unclaimed_profile_mailerlite_failed",
  API_ADMIN_DELETE_UNCLAIMED_PROFILE_NOTIFICATION_FAILED:
    "api_admin_delete_unclaimed_profile_notification_failed",
  API_ADMIN_DELETE_UNCLAIMED_PROFILE_DRAFT_FAILED:
    "api_admin_delete_unclaimed_profile_draft_failed",
  API_ADMIN_DRAFT_UNCLAIMED_PROFILE_FAILED:
    "api_admin_draft_unclaimed_profile_failed",
  API_UNCLAIMED_PROFILE_NOT_FOUND: "api_unclaimed_profile_not_found",
  API_ADMIN_UPDATE_EMAIL_FAILED: "api_admin_update_email_failed",
  API_ADMIN_REFRESH_PAYMENT_DATES_FAILED:
    "api_admin_refresh_payment_dates_failed",
  API_ADMIN_DELETE_DRAFT_PROFILE_FAILED:
    "api_admin_delete_draft_profile_failed",
  API_ADMIN_DELETE_DRAFT_PROFILE_IMAGE_FAILED:
    "api_admin_delete_draft_profile_image_failed",
  API_ADMIN_DELETE_DRAFT_PROFILE_NOTIFICATION_FAILED:
    "api_admin_delete_draft_profile_notification_failed",

  // Admin update email errors
  ADMIN_UPDATE_EMAIL_INVALID_EMAIL: "admin_update_email_invalid_email",
  ADMIN_UPDATE_EMAIL_PROFILE_NOT_FOUND: "admin_update_email_profile_not_found",
  ADMIN_UPDATE_EMAIL_NEW_EMAIL_EXISTS: "admin_update_email_new_email_exists",
  ADMIN_UPDATE_EMAIL_MOVE_FAILED: "admin_update_email_move_failed",

  // Specific admin error scenarios
  API_ADMIN_PROTECTED_FIELD_UPDATE: "api_admin_protected_field_update",
  API_ADMIN_SELF_DELETE_ATTEMPT: "api_admin_self_delete_attempt",
  API_ADMIN_DELETE_ADMIN_ATTEMPT: "api_admin_delete_admin_attempt",
  API_ADMIN_SET_ADMIN_CLAIM_FAILED: "api_admin_set_admin_claim_failed",
  API_ADMIN_REMOVE_ADMIN_CLAIM_FAILED: "api_admin_remove_admin_claim_failed",

  // Firestore infrastructure errors
  API_FIRESTORE_UPDATE_FAILED: "api_firestore_update_failed",
  API_FIRESTORE_READ_FAILED: "api_firestore_read_failed",
  API_FIRESTORE_PERMISSION_DENIED: "api_firestore_permission_denied",
  API_FIRESTORE_NOT_FOUND: "api_firestore_not_found",
  API_FIRESTORE_QUOTA_EXCEEDED: "api_firestore_quota_exceeded",
  API_FIRESTORE_INVALID_DATA: "api_firestore_invalid_data",
  API_FIRESTORE_COUNT_FAILED: "api_firestore_count_failed",

  // Profiles API errors
  API_PROFILE_NOT_FOUND: "api_profile_not_found",
  API_PROFILE_READ_FAILED: "api_profile_read_failed",
  API_PROFILE_WRITE_FAILED: "api_profile_write_failed",
  API_PROFILE_CREATE_FAILED: "api_profile_create_failed",
  API_PROFILE_SLUG_CHECK_FAILED: "api_profile_slug_check_failed",
  API_PROFILE_SLUG_SET_FAILED: "api_profile_slug_set_failed",
  API_PROFILE_CLAIM_FAILED: "api_profile_claim_failed",
  API_HUGO_REBUILD_FAILED: "api_hugo_rebuild_failed",

  // Elysia API Stripe webhook errors
  API_STRIPE_WEBHOOK_MISSING_SIGNATURE: "api_stripe_webhook_missing_signature",
  API_STRIPE_WEBHOOK_INVALID_SIGNATURE: "api_stripe_webhook_invalid_signature",
  API_STRIPE_WEBHOOK_MISSING_CONFIG: "api_stripe_webhook_missing_config",
  API_STRIPE_WEBHOOK_MISSING_EMAIL: "api_stripe_webhook_missing_email",
  API_STRIPE_WEBHOOK_AUTH_LOOKUP_FAILED:
    "api_stripe_webhook_auth_lookup_failed",
  API_STRIPE_WEBHOOK_USER_CREATE_FAILED:
    "api_stripe_webhook_user_create_failed",
  API_STRIPE_WEBHOOK_MEMBER_CREATE_FAILED:
    "api_stripe_webhook_member_create_failed",
  API_STRIPE_WEBHOOK_MEMBER_UPDATE_FAILED:
    "api_stripe_webhook_member_update_failed",
  API_STRIPE_WEBHOOK_ADMIN_CLAIM_FAILED:
    "api_stripe_webhook_admin_claim_failed",
  API_STRIPE_WEBHOOK_UNEXPECTED_ERROR: "api_stripe_webhook_unexpected_error",

  // Email verification errors
  VERIFY_EMAIL_ROUTE_FAILED: "verify_email_route_failed",

  // Member name update errors
  UPDATE_MEMBER_NAME_ROUTE_FAILED: "update_member_name_route_failed",

  // Stripe webhook refund errors
  STRIPE_WEBHOOK_REFUND_MEMBER_LOOKUP_FAILED:
    "stripe_webhook_refund_member_lookup_failed",
  STRIPE_WEBHOOK_REFUND_MEMBER_NOT_FOUND:
    "stripe_webhook_refund_member_not_found",
  STRIPE_WEBHOOK_REFUND_DEACTIVATION_FAILED:
    "stripe_webhook_refund_deactivation_failed",
  STRIPE_WEBHOOK_REFUND_DRAFT_PROFILE_FAILED:
    "stripe_webhook_refund_draft_profile_failed",
  STRIPE_WEBHOOK_REFUND_NEWSLETTER_FAILED:
    "stripe_webhook_refund_newsletter_failed",
  STRIPE_WEBHOOK_REFUND_NOTIFICATION_FAILED:
    "stripe_webhook_refund_notification_failed",
  STRIPE_WEBHOOK_REFUND_SUBSCRIPTION_CANCEL_FAILED:
    "stripe_webhook_refund_subscription_cancel_failed",
  STRIPE_WEBHOOK_REFUND_MEMBER_NOTIFICATION_FAILED:
    "stripe_webhook_refund_member_notification_failed",

  // Stripe webhook subscription ended errors
  STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_MEMBER_LOOKUP_FAILED:
    "stripe_webhook_subscription_ended_member_lookup_failed",
  STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_MEMBER_NOT_FOUND:
    "stripe_webhook_subscription_ended_member_not_found",
  STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_DEACTIVATION_FAILED:
    "stripe_webhook_subscription_ended_deactivation_failed",
  STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_DRAFT_PROFILE_FAILED:
    "stripe_webhook_subscription_ended_draft_profile_failed",
  STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_NEWSLETTER_FAILED:
    "stripe_webhook_subscription_ended_newsletter_failed",
  STRIPE_WEBHOOK_SUBSCRIPTION_ENDED_NOTIFICATION_FAILED:
    "stripe_webhook_subscription_ended_notification_failed",

  // Stripe webhook subscription updated errors
  STRIPE_WEBHOOK_SUBSCRIPTION_UPDATED_MEMBER_LOOKUP_FAILED:
    "stripe_webhook_subscription_updated_member_lookup_failed",
  STRIPE_WEBHOOK_SUBSCRIPTION_UPDATED_MEMBER_NOT_FOUND:
    "stripe_webhook_subscription_updated_member_not_found",
  STRIPE_WEBHOOK_SUBSCRIPTION_UPDATED_STATUS_UPDATE_FAILED:
    "stripe_webhook_subscription_updated_status_update_failed",

  // Admin refund membership errors
  API_ADMIN_REFUND_MEMBERSHIP_FAILED: "api_admin_refund_membership_failed",
  API_ADMIN_REFUND_STRIPE_API_FAILED: "api_admin_refund_stripe_api_failed",
  API_ADMIN_REFUND_NO_STRIPE_DATA: "api_admin_refund_no_stripe_data",

  // Admin clean slate delete errors
  API_ADMIN_CLEAN_SLATE_FAILED: "api_admin_clean_slate_failed",
  API_ADMIN_CLEAN_SLATE_STRIPE_CANCEL_FAILED:
    "api_admin_clean_slate_stripe_cancel_failed",
  API_ADMIN_CLEAN_SLATE_STRIPE_DELETE_FAILED:
    "api_admin_clean_slate_stripe_delete_failed",
  API_ADMIN_CLEAN_SLATE_NEWSLETTER_FAILED:
    "api_admin_clean_slate_newsletter_failed",
  API_ADMIN_CLEAN_SLATE_DELETE_PROFILE_FAILED:
    "api_admin_clean_slate_delete_profile_failed",
  API_ADMIN_CLEAN_SLATE_IMAGE_DELETE_FAILED:
    "api_admin_clean_slate_image_delete_failed",
  API_ADMIN_CLEAN_SLATE_NOTIFICATION_FAILED:
    "api_admin_clean_slate_notification_failed",

  // Admin toggle profile draft errors
  API_ADMIN_TOGGLE_DRAFT_FAILED: "api_admin_toggle_draft_failed",

  // Admin read profile errors
  API_ADMIN_READ_PROFILE_FAILED: "api_admin_read_profile_failed",
  API_ADMIN_UPDATE_PROFILE_FAILED: "api_admin_update_profile_failed",

  // Admin link profile errors
  API_ADMIN_LIST_UNLINKED_PROFILES_FAILED:
    "api_admin_list_unlinked_profiles_failed",
  API_ADMIN_LINK_PROFILE_FAILED: "api_admin_link_profile_failed",
} as const;

export type ErrorId = (typeof ERROR_IDS)[keyof typeof ERROR_IDS];
